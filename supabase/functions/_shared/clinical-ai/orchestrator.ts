import { parseClinicalAiInput, type ClinicalAiInput, type ServerClinicalContext, type ServerClinicalResponse } from './contracts.ts'
import { validateServerResponse } from './security.ts'

export type AuthorizedPrincipal = { userId: string }
export type Reservation = { operationId: string; reused: boolean }
export interface ClinicalAuthorizationPort { authorize(principal: AuthorizedPrincipal, input: ClinicalAiInput): Promise<boolean>; context(principal: AuthorizedPrincipal, input: ClinicalAiInput): Promise<ServerClinicalContext> }
export interface ClinicalQuotaPort { reserve(input: ClinicalAiInput, principal: AuthorizedPrincipal, estimate: { inputTokens: number; outputTokens: number; costMicros: number }): Promise<Reservation>; complete(operationId: string, principal: AuthorizedPrincipal, usage: { status: 'success'|'error'|'canceled'; inputTokens: number; outputTokens: number; costMicros: number; model: string; durationMs: number; errorCode?: string }): Promise<void> }
export interface ClinicalProviderPort { readonly model: string; readonly maxOutputTokens: number; readonly enabled: boolean; estimateMaximumCost(inputTokens: number): number; generate(input: ClinicalAiInput, context: ServerClinicalContext, signal?: AbortSignal): Promise<{ response: ServerClinicalResponse; usage: { inputTokens: number; outputTokens: number; costMicros: number } }> }

export async function runAuthorizedClinicalAiOperation(dependencies: { authorization: ClinicalAuthorizationPort; quota: ClinicalQuotaPort; provider: ClinicalProviderPort }, principal: AuthorizedPrincipal, rawInput: unknown, signal?: AbortSignal) {
  const input = parseClinicalAiInput(rawInput)
  if (!dependencies.provider.enabled) throw new Error('REAL_MODE_DISABLED')
  if (!await dependencies.authorization.authorize(principal, input)) throw new Error('CLINICAL_ACCESS_DENIED')
  const context = await dependencies.authorization.context(principal, input)
  if (context.organizationId !== input.organizationId || context.patientId !== input.patientId) throw new Error('CONTEXT_SCOPE_MISMATCH')
  const inputTokens = Math.ceil(new TextEncoder().encode(JSON.stringify(context)).length / 3)
  if (inputTokens > 120000) throw new Error('INPUT_TOKEN_LIMIT')
  const estimate = { inputTokens, outputTokens: dependencies.provider.maxOutputTokens, costMicros: dependencies.provider.estimateMaximumCost(inputTokens) }
  const reservation = await dependencies.quota.reserve(input, principal, estimate); const started = performance.now()
  if (reservation.reused) throw new Error('IDEMPOTENCY_REPLAY_BLOCKED')
  try {
    const generated = await dependencies.provider.generate(input, context, signal)
    if (!await dependencies.authorization.authorize(principal,input)) throw new Error('CLINICAL_ACCESS_REVOKED')
    if (generated.usage.inputTokens > estimate.inputTokens || generated.usage.outputTokens > estimate.outputTokens || generated.usage.costMicros > estimate.costMicros) throw new Error('PROVIDER_USAGE_EXCEEDS_RESERVATION')
    const response = validateServerResponse(generated.response, context, input.requestId)
    await dependencies.quota.complete(reservation.operationId, principal, { status: 'success', ...generated.usage, model: dependencies.provider.model, durationMs: Math.round(performance.now() - started) })
    return { response, usage: { ...generated.usage, model: dependencies.provider.model }, operationId: reservation.operationId, reused: reservation.reused }
  } catch (reason) {
    const canceled = reason instanceof DOMException && reason.name === 'AbortError'
    try { await dependencies.quota.complete(reservation.operationId, principal, { status: canceled ? 'canceled' : 'error', inputTokens: 0, outputTokens: 0, costMicros: 0, model: dependencies.provider.model, durationMs: Math.round(performance.now() - started), errorCode: reason instanceof Error ? reason.message.slice(0,80) : 'UNKNOWN_ERROR' }) } catch { /* Preserve the provider/validation error; reconciliation is monitored separately. */ }
    throw reason
  }
}
