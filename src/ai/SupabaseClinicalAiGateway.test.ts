import { describe,expect,it,vi } from 'vitest'
import { SupabaseClinicalAiGateway } from './SupabaseClinicalAiGateway'

const request={ requestId:'11111111-1111-4111-8111-111111111111',idempotencyKey:'22222222-2222-4222-8222-222222222222',organizationId:'33333333-3333-4333-8333-333333333333',patientId:'44444444-4444-4444-8444-444444444444',tool:'evolution-analysis' as const,sections:['documented' as const],range:{ start:'2026-10-01',end:'2026-11-10' } }

describe('gateway remoto de IA clínica',()=>{
  it('permanece bloqueado e não invoca função por padrão',async()=>{ const invoke=vi.fn(); const client={ functions:{ invoke } }; await expect(new SupabaseClinicalAiGateway(client as never).generate(request)).rejects.toThrow('indisponível'); expect(invoke).not.toHaveBeenCalled() })
  it('envia somente escopo e contrato, nunca contexto clínico ou chave de provedor',async()=>{ const invoke=vi.fn().mockResolvedValue({ data:{ ok:true },error:null }); const client={ functions:{ invoke } }; await new SupabaseClinicalAiGateway(client as never,true).generate(request); expect(invoke).toHaveBeenCalledWith('clinical-intelligence',expect.objectContaining({ body:request })); expect(JSON.stringify(invoke.mock.calls)).not.toMatch(/apiKey|ANTHROPIC|clinicalContext/) })
  it('traduz falha sem expor detalhes do backend',async()=>{ const client={ functions:{ invoke:vi.fn().mockResolvedValue({ data:null,error:{ message:'segredo interno' } }) } }; await expect(new SupabaseClinicalAiGateway(client as never,true).generate(request)).rejects.toThrow('Nenhum registro clínico foi alterado') })
})
