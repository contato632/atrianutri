import { withSupabase } from 'npm:@supabase/server@1'
import { AnthropicBackendProvider, estimateCostMicros, readAnthropicBackendConfig } from '../_shared/clinical-ai/anthropic.ts'
import { deriveDeterministicTrendSources, prepareServerContext } from '../_shared/clinical-ai/security.ts'
import { runAuthorizedClinicalAiOperation, type ClinicalAuthorizationPort, type ClinicalProviderPort, type ClinicalQuotaPort } from '../_shared/clinical-ai/orchestrator.ts'
import type { ClinicalAiInput, ServerClinicalSource } from '../_shared/clinical-ai/contracts.ts'

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'" } })
const errorStatus = (code: string) => code.includes('DENIED') ? 403 : code === 'IDEMPOTENCY_REPLAY_BLOCKED' ? 409 : code === 'REAL_MODE_DISABLED' ? 503 : code.includes('QUOTA') ? 429 : code.startsWith('INVALID_') || code.includes('LIMIT') || code.includes('RANGE') ? 400 : 502

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405)
    if (ctx.jwtClaims?.aal !== 'aal2') return json({ code:'MFA_REQUIRED',message:'Confirme o segundo fator antes de solicitar análise clínica.' },403)
    const principal = { userId: ctx.userClaims!.id }
    try {
    const config = readAnthropicBackendConfig({ CLINICAL_AI_REAL_MODE:Deno.env.get('CLINICAL_AI_REAL_MODE'),ANTHROPIC_API_KEY:Deno.env.get('ANTHROPIC_API_KEY'),ANTHROPIC_MODEL:Deno.env.get('ANTHROPIC_MODEL'),ANTHROPIC_API_VERSION:Deno.env.get('ANTHROPIC_API_VERSION'),ANTHROPIC_MAX_OUTPUT_TOKENS:Deno.env.get('ANTHROPIC_MAX_OUTPUT_TOKENS'),ANTHROPIC_TIMEOUT_MS:Deno.env.get('ANTHROPIC_TIMEOUT_MS'),ANTHROPIC_INPUT_MICROS_PER_MILLION:Deno.env.get('ANTHROPIC_INPUT_MICROS_PER_MILLION'),ANTHROPIC_OUTPUT_MICROS_PER_MILLION:Deno.env.get('ANTHROPIC_OUTPUT_MICROS_PER_MILLION'),ANTHROPIC_CACHE_WRITE_MICROS_PER_MILLION:Deno.env.get('ANTHROPIC_CACHE_WRITE_MICROS_PER_MILLION'),ANTHROPIC_CACHE_READ_MICROS_PER_MILLION:Deno.env.get('ANTHROPIC_CACHE_READ_MICROS_PER_MILLION') })
    const authorization: ClinicalAuthorizationPort = {
      async authorize(user, input) {
        const { data: member } = await ctx.supabase.from('organization_members').select('user_id').eq('organization_id', input.organizationId).eq('user_id', user.userId).eq('active', true).eq('clinical_access', true).in('role', ['owner','nutritionist']).maybeSingle()
        if (!member) return false
        const { data: assignment } = await ctx.supabase.from('patient_professional_assignments').select('patient_id').eq('organization_id', input.organizationId).eq('patient_id', input.patientId).eq('professional_user_id', user.userId).eq('active', true).maybeSingle()
        return Boolean(assignment)
      },
      async context(_user, input) {
        const base = (table: string, date: string, fields: string) => ctx.supabase.from(table).select(fields).eq('organization_id', input.organizationId).eq('patient_id', input.patientId).gte(date, input.range.start).lte(date, input.range.end).limit(40)
        const [assessments,evaluations,diary,goals,habits,plans,versions,publications] = await Promise.all([
          base('nutrition_assessments','assessed_at','id,assessed_at,weight_kg,height_cm,waist_cm,hip_cm,arm_cm,body_fat_percentage'),
          base('nutrition_evaluations','evaluated_on','id,evaluated_on,consultation_reason,reported_difficulties'),
          base('food_diary_entries','entry_date','id,entry_date,meal_time,meal_type,foods,notes,routine_changes,source'),
          base('habit_goals','created_at','id,created_at,title,description,status'),
          base('habit_check_ins','recorded_on','id,recorded_on,progress,notes,difficulties,source'),
          ctx.supabase.from('meal_plans').select('id,title,status,current_version,updated_at').eq('organization_id',input.organizationId).eq('patient_id',input.patientId).limit(20),
          base('meal_plan_versions','created_at','id,created_at,meal_plan_id,version,change_summary,meals'),
          base('meal_plan_publications','published_at','id,published_at,meal_plan_id,version,status'),
        ])
        const failures = [assessments,evaluations,diary,goals,habits,plans,versions,publications].filter((result) => result.error); if (failures.length) throw new Error('CONTEXT_QUERY_FAILED')
        const normalizedVersions=(versions.data??[]).map((row:Record<string,unknown>)=>({ ...row,meal_count:Array.isArray(row.meals)?row.meals.length:0,meals:undefined }))
        const mapping: Array<[string,string,unknown[]]> = [['assessment','assessed_at',assessments.data??[]],['evaluation','evaluated_on',evaluations.data??[]],['diary','entry_date',diary.data??[]],['goal','created_at',goals.data??[]],['habit','recorded_on',habits.data??[]],['plan','updated_at',plans.data??[]],['plan-version','created_at',normalizedVersions],['plan-publication','published_at',publications.data??[]]]
        const sources: ServerClinicalSource[] = mapping.flatMap(([type,date,rows]) => (rows as Record<string,unknown>[]).map((row) => ({ id: String(row.id), type, date: String(row[date]), trust: 'untrusted-clinical-data' as const, data: Object.fromEntries(Object.entries(row).filter(([key,value]) => !['id',date].includes(key)&&value!==undefined)) })))
        const deterministicSources = deriveDeterministicTrendSources(sources)
        return prepareServerContext({ organizationId: input.organizationId, patientId: input.patientId, range: input.range, sources:[...sources,...deterministicSources], deterministic: { trendSourceRefs: deterministicSources.map((source) => source.id) } })
      },
    }
    const quota: ClinicalQuotaPort = {
      async reserve(input, user, estimate) { const { data, error } = await ctx.supabaseAdmin.rpc('reserve_clinical_ai_operation', { p_request_id: input.requestId, p_organization_id: input.organizationId, p_professional_user_id: user.userId, p_patient_id: input.patientId, p_tool: input.tool, p_idempotency_key: input.idempotencyKey, p_reserved_input_tokens: estimate.inputTokens, p_reserved_output_tokens: estimate.outputTokens, p_reserved_cost_micros: estimate.costMicros }); if (error) throw new Error(error.message.includes('quota') ? 'QUOTA_EXCEEDED' : 'QUOTA_RESERVATION_FAILED'); const row = data?.[0]; return { operationId: row.operation_id, reused: row.reused } },
      async complete(operationId,user,usage) { const { error } = await ctx.supabaseAdmin.rpc('complete_clinical_ai_operation', { p_operation_id: operationId, p_professional_user_id: user.userId, p_status: usage.status, p_input_tokens: usage.inputTokens, p_output_tokens: usage.outputTokens, p_estimated_cost_micros: usage.costMicros, p_model: usage.model, p_duration_ms: usage.durationMs, p_error_code: usage.errorCode ?? null }); if (error) throw new Error('QUOTA_RECONCILIATION_FAILED') },
    }
    const adapter = new AnthropicBackendProvider(config, async ({ url,headers,body,signal }) => { const response = await fetch(url,{ method:'POST',headers,body:JSON.stringify(body),signal }); return { status: response.status, json: await response.json() } })
    const provider: ClinicalProviderPort = { enabled: config.enabled, model: config.model || 'inactive', maxOutputTokens: config.maxOutputTokens || 1, estimateMaximumCost: (tokens) => estimateCostMicros(tokens, config.maxOutputTokens || 0, config), generate: (input,context,signal) => adapter.generate(input,context,signal) }
    return json(await runAuthorizedClinicalAiOperation({ authorization,quota,provider }, principal, await request.json(), request.signal)) }
    catch (reason) { const code = reason instanceof Error ? reason.message : 'UNKNOWN_ERROR'; console.error(JSON.stringify({ event:'clinical_ai_failed', code })); return json({ code, message: 'A análise não está disponível. Nenhum registro clínico foi alterado.' }, errorStatus(code)) }
  }),
}
