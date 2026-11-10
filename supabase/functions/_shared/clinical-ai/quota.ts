import type { ClinicalAiInput, ClinicalAiTool } from './contracts.ts'
import type { AuthorizedPrincipal, ClinicalQuotaPort } from './orchestrator.ts'

export type QuotaLimit = { organizationId: string; professionalId: string; tool: ClinicalAiTool; maxRequests: number; maxInputTokens: number; maxOutputTokens: number; maxCostMicros: number }
type ReservationRow = { operationId: string; key: string; organizationId: string; professionalId: string; tool: ClinicalAiTool; input: number; output: number; cost: number; status: 'reserved'|'success'|'error'|'canceled' }

export class InMemoryAtomicQuota implements ClinicalQuotaPort {
  private rows: ReservationRow[] = []; private queue = Promise.resolve()
  constructor(private readonly limits: QuotaLimit[]) {}
  private exclusive<T>(operation: () => T | Promise<T>) { const next = this.queue.then(operation, operation); this.queue = next.then(() => undefined, () => undefined); return next }
  reserve(input: ClinicalAiInput, principal: AuthorizedPrincipal, estimate: { inputTokens: number; outputTokens: number; costMicros: number }) {
    return this.exclusive(() => {
      const key = `${input.organizationId}:${principal.userId}:${input.idempotencyKey}`; const existing = this.rows.find((row) => row.key === key)
      if (existing) return { operationId: existing.operationId, reused: true }
      const limit = this.limits.find((item) => item.organizationId === input.organizationId && item.professionalId === principal.userId && item.tool === input.tool)
      if (!limit) throw new Error('QUOTA_NOT_CONFIGURED')
      const current = this.rows.filter((row) => row.organizationId === input.organizationId && row.professionalId === principal.userId && row.tool === input.tool && ['reserved','success'].includes(row.status))
      if (current.length + 1 > limit.maxRequests || current.reduce((sum,row) => sum + row.input, estimate.inputTokens) > limit.maxInputTokens || current.reduce((sum,row) => sum + row.output, estimate.outputTokens) > limit.maxOutputTokens || current.reduce((sum,row) => sum + row.cost, estimate.costMicros) > limit.maxCostMicros) throw new Error('QUOTA_EXCEEDED')
      this.rows.push({ operationId: input.requestId, key, organizationId: input.organizationId, professionalId: principal.userId, tool: input.tool, input: estimate.inputTokens, output: estimate.outputTokens, cost: estimate.costMicros, status: 'reserved' })
      return { operationId: input.requestId, reused: false }
    })
  }
  complete(operationId: string, principal: AuthorizedPrincipal, usage: { status: 'success'|'error'|'canceled'; inputTokens: number; outputTokens: number; costMicros: number }) { return this.exclusive(() => { const row = this.rows.find((item) => item.operationId === operationId && item.professionalId === principal.userId); if (!row || row.status !== 'reserved') throw new Error('OPERATION_ALREADY_COMPLETED'); row.status = usage.status; if (usage.status === 'success') { row.input=usage.inputTokens; row.output=usage.outputTokens; row.cost=usage.costMicros } }) }
  snapshot() { return structuredClone(this.rows) }
}
