export const CLINICAL_AI_TOOLS = ['evolution-analysis', 'appointment-preparation', 'investigation-questions', 'clinical-summary'] as const
export const CLINICAL_SECTIONS = ['documented', 'trends', 'investigation', 'limitations'] as const
export type ClinicalAiTool = typeof CLINICAL_AI_TOOLS[number]
export type ClinicalSection = typeof CLINICAL_SECTIONS[number]
export type ClinicalAiInput = { requestId: string; idempotencyKey: string; organizationId: string; patientId: string; tool: ClinicalAiTool; sections: ClinicalSection[]; range: { start: string; end: string } }
export type ServerClinicalSource = { id: string; type: string; date: string; data: Record<string, unknown>; trust: 'untrusted-clinical-data' | 'deterministic' }
export type ServerClinicalContext = { schemaVersion: 1; organizationId: string; patientId: string; range: { start: string; end: string }; sources: ServerClinicalSource[]; deterministic: Record<string, unknown> }
export type ClinicalEvidence = { sourceRef: string; path: string; value: string | number | boolean | null; unit?: string }
export type ServerClinicalStatement = { text: string; sourceRefs: string[]; kind: 'fact' | 'trend' | 'hypothesis' | 'limitation'; verification: 'verified' | 'not-verifiable'; evidence: ClinicalEvidence[] }
export type ServerClinicalResponse = { requestId: string; model: string; sections: Record<ClinicalSection, ServerClinicalStatement[]> }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const date = /^\d{4}-\d{2}-\d{2}$/
export function parseClinicalAiInput(value: unknown): ClinicalAiInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REQUEST')
  const row = value as Record<string, unknown>; const range = row.range as Record<string, unknown> | undefined
  if (![row.requestId,row.idempotencyKey,row.organizationId,row.patientId].every((item) => typeof item === 'string' && uuid.test(item))) throw new Error('INVALID_IDENTIFIERS')
  if (!CLINICAL_AI_TOOLS.includes(row.tool as ClinicalAiTool)) throw new Error('INVALID_TOOL')
  if (!Array.isArray(row.sections) || !row.sections.length || row.sections.some((item) => !CLINICAL_SECTIONS.includes(item as ClinicalSection))) throw new Error('INVALID_SECTIONS')
  if (!range || typeof range.start !== 'string' || typeof range.end !== 'string' || !date.test(range.start) || !date.test(range.end) || range.start > range.end) throw new Error('INVALID_RANGE')
  const start = new Date(`${range.start}T00:00:00Z`); const end = new Date(`${range.end}T00:00:00Z`)
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || (end.valueOf() - start.valueOf()) / 86400000 > 366) throw new Error('RANGE_TOO_LARGE')
  return { requestId: row.requestId as string, idempotencyKey: row.idempotencyKey as string, organizationId: row.organizationId as string, patientId: row.patientId as string, tool: row.tool as ClinicalAiTool, sections: [...new Set(row.sections as ClinicalSection[])], range: { start: range.start, end: range.end } }
}
