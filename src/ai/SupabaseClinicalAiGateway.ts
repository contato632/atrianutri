import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClinicalAiTool, ClinicalSectionKey } from './clinicalAssistant'
import type { DateRange } from '../domain/nutritionIntelligence'

export type RemoteClinicalAiRequest = { requestId: string; idempotencyKey: string; organizationId: string; patientId: string; tool: ClinicalAiTool; sections: ClinicalSectionKey[]; range: DateRange }

/** Future backend gateway. It never accepts a clinical context or provider credential from the browser. */
export class SupabaseClinicalAiGateway {
  constructor(private readonly client: SupabaseClient, private readonly enabled = false) {}
  async generate(request: RemoteClinicalAiRequest, signal?: AbortSignal) {
    if (!this.enabled) throw new Error('Integração real indisponível até homologação e autorização explícita.')
    const { data,error } = await this.client.functions.invoke('clinical-intelligence',{ body:request,headers:{ 'x-idempotency-key':request.idempotencyKey },signal })
    if (error) throw new Error('O backend de análise não está disponível. Nenhum registro clínico foi alterado.')
    return data as unknown
  }
}
