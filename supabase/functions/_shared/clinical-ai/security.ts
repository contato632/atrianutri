import type { ServerClinicalContext, ServerClinicalResponse, ServerClinicalSource } from './contracts.ts'

const forbiddenAuthority = /\b(diagn[oó]stic[oa] (confirmad[oa]|definitiv[oa])|prescrev[ae]|causou|progn[oó]stico (confirmado|definido)|tratamento indicado)\b/i
const hostileMarkup = /<\/?(?:script|iframe|object|embed|style|svg)|javascript:|on(?:error|load|click)\s*=/i
const sensitiveKeys = /^(full_?name|name|email|phone|document|cpf|address|birth_?date|auth_?user_?id|professional_?observations|private_?note)$/i
const normalizeText = (value: string, max = 2000) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(new RegExp(hostileMarkup.source,'gi'), '[conteúdo removido]').slice(0, max)

function minimize(value: unknown, depth = 0): unknown {
  if (depth > 5) return undefined
  if (typeof value === 'string') return normalizeText(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => minimize(item, depth + 1)).filter((item) => item !== undefined)
  if (!value || typeof value !== 'object') return undefined
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !sensitiveKeys.test(key)).slice(0, 40).map(([key, item]) => [key, minimize(item, depth + 1)]).filter(([, item]) => item !== undefined))
}

export function prepareServerContext(input: Omit<ServerClinicalContext, 'schemaVersion' | 'sources'> & { sources: ServerClinicalSource[] }, options = { maxSources: 120, maxBytes: 90000 }): ServerClinicalContext {
  if (input.sources.length > options.maxSources) throw new Error('CONTEXT_SOURCE_LIMIT')
  const sources = input.sources.map((source) => ({ id: source.id, type: source.type, date: source.date.slice(0, 10), trust: source.trust, data: minimize(source.data) as Record<string, unknown> }))
  const context: ServerClinicalContext = { schemaVersion: 1, organizationId: input.organizationId, patientId: input.patientId, range: input.range, sources, deterministic: minimize(input.deterministic) as Record<string, unknown> }
  if (new TextEncoder().encode(JSON.stringify(context)).length > options.maxBytes) throw new Error('CONTEXT_SIZE_LIMIT')
  return context
}

export function deriveDeterministicTrendSources(sources: ServerClinicalSource[]): ServerClinicalSource[] {
  const metrics = [{ key:'weight_kg',unit:'kg' },{ key:'height_cm',unit:'cm' },{ key:'waist_cm',unit:'cm' },{ key:'hip_cm',unit:'cm' },{ key:'arm_cm',unit:'cm' },{ key:'body_fat_percentage',unit:'%' }]
  const assessments = sources.filter((source) => source.type === 'assessment').sort((a,b) => a.date.localeCompare(b.date))
  return metrics.flatMap(({ key,unit }) => {
    const points = assessments.flatMap((source) => typeof source.data[key] === 'number' ? [{ source, value: source.data[key] as number }] : [])
    if (points.length < 2) return []
    const first=points[0],last=points.at(-1)!; const intervalDays=Math.round((new Date(`${last.source.date}T00:00:00Z`).valueOf()-new Date(`${first.source.date}T00:00:00Z`).valueOf())/86400000)
    return [{ id:`deterministic:${key}:${first.source.id}:${last.source.id}`,type:'deterministic-trend',date:last.source.date,trust:'deterministic' as const,data:{ metric:key,unit,firstValue:first.value,lastValue:last.value,absoluteChange:Number((last.value-first.value).toFixed(4)),intervalDays,sourceRefs:[first.source.id,last.source.id] } }]
  })
}

const pathValue = (source: ServerClinicalSource, path: string) => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, source.data)
const numberTokens = (text: string) => [...text.matchAll(/(?<![\p{L}\d])[-+]?\d+(?:[.,]\d+)?(?![\p{L}\d])/gu)].map((match) => Number(match[0].replace(',','.'))).filter(Number.isFinite)

export function validateServerResponse(response: ServerClinicalResponse, context: ServerClinicalContext, requestId: string): ServerClinicalResponse {
  if (!response || response.requestId !== requestId || typeof response.model !== 'string' || !response.sections) throw new Error('INVALID_PROVIDER_RESPONSE')
  if (!['documented','trends','investigation','limitations'].every((key) => Array.isArray(response.sections[key as keyof typeof response.sections]))) throw new Error('INVALID_RESPONSE_SECTION')
  const sources = new Map(context.sources.map((source) => [source.id, source])); const result = structuredClone(response)
  for (const [section, statements] of Object.entries(result.sections)) {
    if (!['documented','trends','investigation','limitations'].includes(section) || !Array.isArray(statements)) throw new Error('INVALID_RESPONSE_SECTION')
    for (const item of statements) {
      if (!item || typeof item.text !== 'string' || !item.text.trim() || hostileMarkup.test(item.text) || forbiddenAuthority.test(item.text)) throw new Error('UNSAFE_RESPONSE_TEXT')
      if (!Array.isArray(item.sourceRefs) || !Array.isArray(item.evidence) || !['fact','trend','hypothesis','limitation'].includes(item.kind)) throw new Error('INVALID_RESPONSE_STATEMENT')
      const expectedKind = { documented:'fact',trends:'trend',investigation:'hypothesis',limitations:'limitation' }[section]
      if (item.kind !== expectedKind) throw new Error('STATEMENT_KIND_MISMATCH')
      if (item.sourceRefs.some((id) => !sources.has(id)) || item.evidence.some((entry) => !sources.has(entry.sourceRef))) throw new Error('UNAUTHORIZED_REFERENCE')
      if ((section === 'documented' || section === 'trends') && (item.verification !== 'verified' || !item.sourceRefs.length || !item.evidence.length)) throw new Error('UNVERIFIED_FACT')
      for (const evidence of item.evidence) {
        if (!item.sourceRefs.includes(evidence.sourceRef)) throw new Error('EVIDENCE_REFERENCE_MISMATCH')
        const actual = pathValue(sources.get(evidence.sourceRef)!, evidence.path)
        if (actual !== evidence.value) throw new Error('EVIDENCE_VALUE_MISMATCH')
        if (typeof evidence.value === 'number' && (!evidence.unit || !['kg','cm','%','days','count','version','time'].includes(evidence.unit))) throw new Error('INVALID_EVIDENCE_UNIT')
      }
      if (section === 'documented' || section === 'trends') {
        const evidenceNumbers = item.evidence.flatMap((entry) => typeof entry.value === 'number' ? [entry.value] : typeof entry.value === 'string' ? numberTokens(entry.value) : [])
        if (numberTokens(item.text).some((value) => !evidenceNumbers.some((known) => Math.abs(known - value) < 0.0001))) throw new Error('INVENTED_NUMERIC_CLAIM')
      }
      item.text = normalizeText(item.text, 3000)
    }
  }
  return result
}
