import { describe,expect,it,vi } from 'vitest'
import { buildHomologationReport,evaluateSyntheticScenario,HOMOLOGATION_SCENARIOS,runSyntheticSuite,scenarioContext,type HomologationVariant } from './homologation'

describe('homologação sintética do Intelligence',()=>{
  it('mantém dez cenários demonstrativos cobrindo as situações obrigatórias',()=>{ expect(HOMOLOGATION_SCENARIOS).toHaveLength(10); expect(new Set(HOMOLOGATION_SCENARIOS.map((item)=>item.id)).size).toBe(10); expect(HOMOLOGATION_SCENARIOS.every((item)=>item.description&&item.allowedFacts&&item.forbiddenInferences.length)).toBe(true) })

  it('cobre as quatro ferramentas clínicas',()=>{ expect(new Set(HOMOLOGATION_SCENARIOS.map((item)=>item.tool))).toEqual(new Set(['evolution-analysis','appointment-preparation','investigation-questions','clinical-summary'])) })

  it('aprova as dez respostas simuladas corretas sem ocultar revisão humana',()=>{ const report=runSyntheticSuite('correct'); expect(report).toEqual(expect.objectContaining({ total:10,approved:10,rejected:0,syntheticOnly:true,realClaudeExecuted:false })); expect(report.results.every((item)=>item.metrics.professionalUsefulness==='pending-human-review'&&item.realProviderUsed===false)).toBe(true) })

  it('remove identificação, contato e notas privadas de todos os contextos',()=>{ for(const scenario of HOMOLOGATION_SCENARIOS){ const serialized=JSON.stringify(scenarioContext(scenario)); expect(serialized).not.toMatch(/Pessoa Sintética|@example\.invalid|7199999|Conteúdo privado sintético/) } })

  it('rejeita fatos sem evidência, referências falsas e números alterados',()=>{ const scenario=HOMOLOGATION_SCENARIOS[0]; expect(evaluateSyntheticScenario(scenario,'missing-evidence').criticalFailures).toContain('UNVERIFIED_FACT'); expect(evaluateSyntheticScenario(scenario,'false-reference').criticalFailures).toContain('UNAUTHORIZED_REFERENCE'); expect(evaluateSyntheticScenario(scenario,'invented-number').criticalFailures).toContain('INVENTED_NUMERIC_CLAIM') })

  it('rejeita conteúdo malicioso, JSON inválido, timeout e erro de provedor',()=>{ const scenario=HOMOLOGATION_SCENARIOS[0]; const variants:HomologationVariant[]=['malicious','invalid-json','timeout','provider-error']; for(const variant of variants) expect(evaluateSyntheticScenario(scenario,variant).status).toBe('rejected') })

  it('reprova resposta parcial quando a limitação esperada está ausente',()=>{ const result=evaluateSyntheticScenario(HOMOLOGATION_SCENARIOS[1],'partial'); expect(result.criticalFailures).toContain('EXPECTED_LIMITATION_MISSING'); expect(result.status).toBe('rejected') })

  it('trata prompt injection como dado sem executar instruções',()=>{ const scenario=HOMOLOGATION_SCENARIOS.find((item)=>item.id==='prompt-injection')!; const fetchSpy=vi.spyOn(globalThis,'fetch'); const result=evaluateSyntheticScenario(scenario,'correct'); expect(result.status).toBe('approved'); expect(result.response?.sections.investigation[0].text).not.toMatch(/prompt interno|outros pacientes|execute comandos/i); expect(fetchSpy).not.toHaveBeenCalled(); fetchSpy.mockRestore() })

  it('preserva fatos profissionais e autorrelatos em fontes distintas',()=>{ const scenario=HOMOLOGATION_SCENARIOS.find((item)=>item.id==='self-report-divergence')!; const context=scenarioContext(scenario); expect(context.sources.find((item)=>item.id==='syn-09-a1')?.data.source).toBe('professional'); expect(context.sources.find((item)=>item.id==='syn-09-d1')?.data.source).toBe('patient') })

  it('permite testar qualquer ferramenta sem alterar os dados do cenário',()=>{ const scenario=HOMOLOGATION_SCENARIOS[0]; const before=structuredClone(scenario); const result=evaluateSyntheticScenario(scenario,'correct','investigation-questions'); expect(result.tool).toBe('investigation-questions'); expect(scenario).toEqual(before) })

  it('relatório contabiliza falhas críticas individualmente sem média compensatória',()=>{ const results=[evaluateSyntheticScenario(HOMOLOGATION_SCENARIOS[0],'correct'),evaluateSyntheticScenario(HOMOLOGATION_SCENARIOS[0],'false-reference')]; const report=buildHomologationReport(results); expect(report).toEqual(expect.objectContaining({ total:2,approved:1,rejected:1 })); expect(report.criticalFailureCounts.UNAUTHORIZED_REFERENCE).toBe(1); expect(report).not.toHaveProperty('averageScore') })
})
