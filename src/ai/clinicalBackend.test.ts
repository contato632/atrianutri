import { describe, expect, it, vi } from 'vitest'
import { AnthropicBackendProvider, estimateCostMicros, readAnthropicBackendConfig } from '../../supabase/functions/_shared/clinical-ai/anthropic.ts'
import { parseClinicalAiInput, type ClinicalAiInput, type ServerClinicalContext, type ServerClinicalResponse } from '../../supabase/functions/_shared/clinical-ai/contracts.ts'
import { runAuthorizedClinicalAiOperation, type ClinicalAuthorizationPort, type ClinicalProviderPort, type ClinicalQuotaPort } from '../../supabase/functions/_shared/clinical-ai/orchestrator.ts'
import { InMemoryAtomicQuota } from '../../supabase/functions/_shared/clinical-ai/quota.ts'
import { deriveDeterministicTrendSources, prepareServerContext, validateServerResponse } from '../../supabase/functions/_shared/clinical-ai/security.ts'

const ids = { request:'11111111-1111-4111-8111-111111111111', idempotency:'22222222-2222-4222-8222-222222222222', organization:'33333333-3333-4333-8333-333333333333', patient:'44444444-4444-4444-8444-444444444444', professional:'55555555-5555-4555-8555-555555555555' }
const input = (tool: ClinicalAiInput['tool'] = 'evolution-analysis', patch: Partial<ClinicalAiInput> = {}): ClinicalAiInput => ({ requestId:ids.request,idempotencyKey:ids.idempotency,organizationId:ids.organization,patientId:ids.patient,tool,sections:['documented','trends','investigation','limitations'],range:{ start:'2026-08-01',end:'2026-11-10' },...patch })
const sources = [
  { id:'assessment-1',type:'assessment',date:'2026-08-01',trust:'untrusted-clinical-data' as const,data:{ weight_kg:72,full_name:'Paciente Identificável',email:'real@example.test',private_note:'não enviar' } },
  { id:'assessment-2',type:'assessment',date:'2026-11-01',trust:'untrusted-clinical-data' as const,data:{ weight_kg:70,phone:'71999999999' } },
]
const context = (): ServerClinicalContext => { const deterministic=deriveDeterministicTrendSources(sources); return prepareServerContext({ organizationId:ids.organization,patientId:ids.patient,range:input().range,sources:[...sources,...deterministic],deterministic:{ trendSourceRefs:deterministic.map((item)=>item.id) } }) }
const validResponse = (toolInput=input(), ctx=context()): ServerClinicalResponse => { const trend=ctx.sources.find((item)=>item.type==='deterministic-trend')!; return { requestId:toolInput.requestId,model:'provider-test',sections:{ documented:[{ text:'Peso registrado: 70 kg.',sourceRefs:['assessment-2'],kind:'fact',verification:'verified',evidence:[{ sourceRef:'assessment-2',path:'weight_kg',value:70,unit:'kg' }] }],trends:[{ text:'Diferença aritmética: -2 kg em 92 dias.',sourceRefs:[trend.id],kind:'trend',verification:'verified',evidence:[{ sourceRef:trend.id,path:'absoluteChange',value:-2,unit:'kg' },{ sourceRef:trend.id,path:'intervalDays',value:92,unit:'days' }] }],investigation:[{ text:'Explorar mudanças de contexto relatadas.',sourceRefs:['assessment-2'],kind:'hypothesis',verification:'not-verifiable',evidence:[] }],limitations:[{ text:'Os registros não demonstram causalidade.',sourceRefs:[],kind:'limitation',verification:'not-verifiable',evidence:[] }] } } }

describe('backend seguro de Clinical Intelligence', () => {
  it('aceita somente identificadores, ferramenta, seções e período válidos', () => {
    expect(parseClinicalAiInput(input())).toEqual(input())
    expect(() => parseClinicalAiInput({ ...input(), patientId:'outro' })).toThrow('INVALID_IDENTIFIERS')
    expect(() => parseClinicalAiInput({ ...input(), tool:'delete-records' })).toThrow('INVALID_TOOL')
    expect(() => parseClinicalAiInput({ ...input(), range:{ start:'2025-01-01',end:'2026-11-10' } })).toThrow('RANGE_TOO_LARGE')
  })

  it('minimiza identificadores, contatos e notas privadas no contexto', () => {
    const serialized=JSON.stringify(context())
    expect(serialized).not.toContain('Paciente Identificável'); expect(serialized).not.toContain('real@example.test'); expect(serialized).not.toContain('71999999999'); expect(serialized).not.toContain('não enviar')
    expect(serialized).toContain('weight_kg')
  })

  it('limita volume de fontes e bytes antes do provedor', () => {
    expect(() => prepareServerContext({ organizationId:ids.organization,patientId:ids.patient,range:input().range,sources:Array.from({length:3},(_,index)=>({ ...sources[0],id:String(index) })),deterministic:{} },{ maxSources:2,maxBytes:90000 })).toThrow('CONTEXT_SOURCE_LIMIT')
    expect(() => prepareServerContext({ organizationId:ids.organization,patientId:ids.patient,range:input().range,sources:[{ ...sources[0],data:{ notes:'x'.repeat(3000) } }],deterministic:{} },{ maxSources:2,maxBytes:100 })).toThrow('CONTEXT_SIZE_LIMIT')
  })

  it('preserva tendências numéricas somente em fontes determinísticas', () => {
    const trends=deriveDeterministicTrendSources(sources)
    expect(trends[0]).toEqual(expect.objectContaining({ trust:'deterministic',data:expect.objectContaining({ absoluteChange:-2,intervalDays:92,unit:'kg' }) }))
  })

  it('valida estrutura, referências, evidências, números e unidades', () => {
    const ctx=context(); expect(validateServerResponse(validResponse(input(),ctx),ctx,ids.request).sections.trends).toHaveLength(1)
    const invented=validResponse(input(),ctx); invented.sections.documented[0].sourceRefs=['patient-from-other-org']; expect(() => validateServerResponse(invented,ctx,ids.request)).toThrow('UNAUTHORIZED_REFERENCE')
    const value=validResponse(input(),ctx); value.sections.documented[0].evidence[0].value=71; expect(() => validateServerResponse(value,ctx,ids.request)).toThrow('EVIDENCE_VALUE_MISMATCH')
    const number=validResponse(input(),ctx); number.sections.documented[0].text='Peso registrado: 99 kg.'; expect(() => validateServerResponse(number,ctx,ids.request)).toThrow('INVENTED_NUMERIC_CLAIM')
    const unit=validResponse(input(),ctx); unit.sections.documented[0].evidence[0].unit='calorias inventadas'; expect(() => validateServerResponse(unit,ctx,ids.request)).toThrow('INVALID_EVIDENCE_UNIT')
  })

  it('rejeita fatos sem fonte, tipo trocado, HTML e autoridade clínica', () => {
    const ctx=context(); const noSource=validResponse(input(),ctx); noSource.sections.documented[0].sourceRefs=[]; expect(() => validateServerResponse(noSource,ctx,ids.request)).toThrow('UNVERIFIED_FACT')
    const kind=validResponse(input(),ctx); kind.sections.documented[0].kind='hypothesis'; expect(() => validateServerResponse(kind,ctx,ids.request)).toThrow('STATEMENT_KIND_MISMATCH')
    const html=validResponse(input(),ctx); html.sections.investigation[0].text='<script>alert(1)</script>'; expect(() => validateServerResponse(html,ctx,ids.request)).toThrow('UNSAFE_RESPONSE_TEXT')
    const diagnosis=validResponse(input(),ctx); diagnosis.sections.investigation[0].text='Diagnóstico confirmado.'; expect(() => validateServerResponse(diagnosis,ctx,ids.request)).toThrow('UNSAFE_RESPONSE_TEXT')
  })

  it('mantém configuração real bloqueada por padrão e exige todas as variáveis', () => {
    expect(readAnthropicBackendConfig({}).enabled).toBe(false)
    expect(() => readAnthropicBackendConfig({ CLINICAL_AI_REAL_MODE:'enabled' })).toThrow('INVALID_ANTHROPIC_BACKEND_CONFIG')
  })

  it('calcula custo exclusivamente com preços configurados no backend', () => {
    expect(estimateCostMicros(1000,500,{ inputMicrosPerMillion:3_000_000,outputMicrosPerMillion:15_000_000 })).toBe(10500)
    expect(estimateCostMicros(100,20,{inputMicrosPerMillion:1_000_000,outputMicrosPerMillion:2_000_000,cacheWriteMicrosPerMillion:3_000_000,cacheReadMicrosPerMillion:500_000},50,25)).toBe(303)
    expect(() => estimateCostMicros(1,1,{ inputMicrosPerMillion:-1,outputMicrosPerMillion:1 })).toThrow('INVALID_COST_INPUT')
  })

  it('não chama transporte Anthropic quando o modo real está desativado', async () => {
    const transport=vi.fn(); const provider=new AnthropicBackendProvider(readAnthropicBackendConfig({}),transport)
    await expect(provider.generate(input(),context())).rejects.toThrow('REAL_MODE_DISABLED'); expect(transport).not.toHaveBeenCalled()
  })

  it('aplica timeout, cancelamento e falha de rede simulados', async () => {
    const config=readAnthropicBackendConfig({ CLINICAL_AI_REAL_MODE:'enabled',ANTHROPIC_API_KEY:'test-only',ANTHROPIC_MODEL:'configured-at-runtime',ANTHROPIC_API_VERSION:'controlled-version',ANTHROPIC_MAX_OUTPUT_TOKENS:'100',ANTHROPIC_TIMEOUT_MS:'1000',ANTHROPIC_INPUT_MICROS_PER_MILLION:'1',ANTHROPIC_OUTPUT_MICROS_PER_MILLION:'1',ANTHROPIC_CACHE_WRITE_MICROS_PER_MILLION:'1',ANTHROPIC_CACHE_READ_MICROS_PER_MILLION:'1' })
    const failed=new AnthropicBackendProvider(config,async()=>{ throw new Error('SIMULATED_NETWORK_FAILURE') }); await expect(failed.generate(input(),context())).rejects.toThrow('SIMULATED_NETWORK_FAILURE')
    const controller=new AbortController(); const canceled=new AnthropicBackendProvider(config,(_request)=>new Promise((_resolve,reject)=>_request.signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')),{once:true}))); const promise=canceled.generate(input(),context(),controller.signal); controller.abort(); await expect(promise).rejects.toMatchObject({ name:'AbortError' })
  })

  it('reserva cota atomicamente e impede concorrência acima do limite', async () => {
    const quota=new InMemoryAtomicQuota([{ organizationId:ids.organization,professionalId:ids.professional,tool:'evolution-analysis',maxRequests:1,maxInputTokens:100,maxOutputTokens:100,maxCostMicros:100 }]); const principal={ userId:ids.professional }
    const a=quota.reserve(input(),principal,{ inputTokens:10,outputTokens:10,costMicros:10 }); const b=quota.reserve(input('evolution-analysis',{ requestId:'66666666-6666-4666-8666-666666666666',idempotencyKey:'77777777-7777-4777-8777-777777777777' }),principal,{ inputTokens:10,outputTokens:10,costMicros:10 }); const results=await Promise.allSettled([a,b])
    expect(results.filter((item)=>item.status==='fulfilled')).toHaveLength(1); expect(results.filter((item)=>item.status==='rejected')).toHaveLength(1)
  })

  it('torna a reserva idempotente sem duplicar consumo', async () => {
    const quota=new InMemoryAtomicQuota([{ organizationId:ids.organization,professionalId:ids.professional,tool:'evolution-analysis',maxRequests:2,maxInputTokens:100,maxOutputTokens:100,maxCostMicros:100 }]); const principal={ userId:ids.professional }
    expect((await quota.reserve(input(),principal,{ inputTokens:10,outputTokens:10,costMicros:10 })).reused).toBe(false); expect((await quota.reserve(input(),principal,{ inputTokens:10,outputTokens:10,costMicros:10 })).reused).toBe(true); expect(quota.snapshot()).toHaveLength(1)
  })

  it('verifica autorização e escopo antes de contexto, cota ou provedor', async () => {
    const authorization:ClinicalAuthorizationPort={ authorize:vi.fn(async()=>false),context:vi.fn() }; const quota={ reserve:vi.fn(),complete:vi.fn() } as unknown as ClinicalQuotaPort; const provider={ enabled:true,model:'test',maxOutputTokens:100,estimateMaximumCost:()=>1,generate:vi.fn() } as unknown as ClinicalProviderPort
    await expect(runAuthorizedClinicalAiOperation({ authorization,quota,provider },{ userId:ids.professional },input())).rejects.toThrow('CLINICAL_ACCESS_DENIED'); expect(authorization.context).not.toHaveBeenCalled(); expect(quota.reserve).not.toHaveBeenCalled(); expect(provider.generate).not.toHaveBeenCalled()
  })

  it('bloqueia vínculo revogado e organização divergente', async () => {
    const revoked:ClinicalAuthorizationPort={ authorize:async()=>false,context:async()=>context() }; const provider={ enabled:true,model:'test',maxOutputTokens:100,estimateMaximumCost:()=>1,generate:vi.fn() } as unknown as ClinicalProviderPort; const quota={ reserve:vi.fn(),complete:vi.fn() } as unknown as ClinicalQuotaPort
    await expect(runAuthorizedClinicalAiOperation({ authorization:revoked,quota,provider },{ userId:ids.professional },input())).rejects.toThrow('CLINICAL_ACCESS_DENIED')
    const wrongOrg:ClinicalAuthorizationPort={ authorize:async()=>true,context:async()=>({ ...context(),organizationId:'88888888-8888-4888-8888-888888888888' }) }; await expect(runAuthorizedClinicalAiOperation({ authorization:wrongOrg,quota,provider },{ userId:ids.professional },input())).rejects.toThrow('CONTEXT_SCOPE_MISMATCH')
  })

  it('descarta o resultado se o vínculo for revogado durante a operação',async()=>{
    let authorized=true; const request=input(); const ctx=context(); const authorization:ClinicalAuthorizationPort={ authorize:async()=>authorized,context:async()=>ctx }; const complete=vi.fn(); const quota:ClinicalQuotaPort={ reserve:async()=>({operationId:request.requestId,reused:false}),complete }; const provider:ClinicalProviderPort={ enabled:true,model:'test',maxOutputTokens:1000,estimateMaximumCost:()=>100,generate:async()=>{authorized=false;return {response:validResponse(request,ctx),usage:{inputTokens:10,outputTokens:10,costMicros:10}}} }
    await expect(runAuthorizedClinicalAiOperation({authorization,quota,provider},{userId:ids.professional},request)).rejects.toThrow('CLINICAL_ACCESS_REVOKED'); expect(complete).toHaveBeenCalledWith(request.requestId,{userId:ids.professional},expect.objectContaining({status:'error',errorCode:'CLINICAL_ACCESS_REVOKED'}))
  })

  it('integra as quatro ferramentas sem modificar registros clínicos', async () => {
    for (const tool of ['evolution-analysis','appointment-preparation','investigation-questions','clinical-summary'] as const) {
      const request=input(tool,{ requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID() }); const ctx=context(); const before=structuredClone(ctx)
      const authorization:ClinicalAuthorizationPort={ authorize:async()=>true,context:async()=>ctx }; const quota:ClinicalQuotaPort={ reserve:async()=>({ operationId:request.requestId,reused:false }),complete:async()=>undefined }; const response=validResponse(request,ctx)
      const provider:ClinicalProviderPort={ enabled:true,model:'test',maxOutputTokens:1000,estimateMaximumCost:()=>100,generate:async()=>({ response,usage:{ inputTokens:10,outputTokens:10,costMicros:10 } }) }
      await expect(runAuthorizedClinicalAiOperation({ authorization,quota,provider },{ userId:ids.professional },request)).resolves.toEqual(expect.objectContaining({ response })); expect(ctx).toEqual(before)
    }
  })
})
