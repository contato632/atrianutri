import { describe, expect, it } from 'vitest'
import { demoWorkspace } from '../data/demo-data'
import { anthropometricTrends, buildNutritionTimeline, diaryIndicators, generateDescriptiveInsights, habitIndicators, periodRange, prepareFollowUpSummary } from './nutritionIntelligence'

const range = { start: '2026-08-01', end: '2026-11-10' }

describe('Intelligence Nutricional determinística', () => {
  it('ordena a linha do tempo e mantém referências rastreáveis', () => {
    const events = buildNutritionTimeline(demoWorkspace, 'demo-patient-ana', range)
    expect(events.length).toBeGreaterThan(5)
    expect(events.map((item) => item.date)).toEqual([...events.map((item) => item.date)].sort().reverse())
    expect(events.every((item) => item.sourceRefs.length > 0 && item.href)).toBe(true)
  })

  it('isola integralmente pacientes e não inclui dados financeiros ou notas privadas', () => {
    const serialized = JSON.stringify(buildNutritionTimeline(demoWorkspace, 'demo-patient-ana', range))
    expect(serialized).not.toContain('Rafael Monteiro')
    expect(serialized).not.toContain('charge-ana')
    expect(serialized).not.toContain('Observar regularidade em dias de trabalho')
  })

  it('calcula variação absoluta, percentual e intervalo sem inferência', () => {
    const trends = anthropometricTrends(demoWorkspace.assessments.filter((item) => item.patientId === 'demo-patient-ana'), range)
    const weight = trends.find((item) => item.key === 'weightKg')!
    expect(weight.points).toHaveLength(3)
    expect(weight.absoluteChange).toBe(-2.1)
    expect(weight.percentageChange).toBe(-2.92)
    expect(weight.intervalDays).toBe(70)
  })

  it('preserva medidas ausentes sem fabricar pontos', () => {
    const trends = anthropometricTrends([{ id: 'a', patientId: 'p', assessedAt: '2026-01-01', weightKg: 70, heightCm: 170, bmi: 24.2, notes: '', createdAt: '' }], { start: '2026-01-01', end: '2026-01-31' })
    expect(trends.map((item) => item.key)).toEqual(['weightKg'])
    expect(trends[0].absoluteChange).toBeUndefined()
  })

  it('distingue consumo relatado, registro profissional e plano prescrito', () => {
    const indicator = diaryIndicators(demoWorkspace, 'demo-patient-ana', range)
    expect(indicator.patientReported).toBe(2)
    expect(indicator.professionalRecorded).toBe(1)
    expect(indicator.prescribedMeals).toBe(2)
  })

  it('mede registros e intervalos sem classificar adesão', () => {
    const indicator = habitIndicators(demoWorkspace, 'demo-patient-ana', range)
    expect(indicator.checkIns).toBe(2)
    expect(indicator.barriers).toBe(2)
    expect(JSON.stringify(indicator)).not.toMatch(/ader|sucesso|fracasso/i)
  })

  it('gera insights com regra, limitações, período e fontes', () => {
    const insights = generateDescriptiveInsights(demoWorkspace, 'demo-patient-ana', range)
    expect(insights.some((item) => item.id === 'waist-latest')).toBe(true)
    expect(insights.every((item) => item.rule && item.limitations && item.sourceRefs.length && item.interval.start)).toBe(true)
    expect(JSON.stringify(insights)).not.toMatch(/diagnóstico|causou|aderente|não aderente/i)
  })

  it('produz resumo editável determinístico e explicita limitações', () => {
    const first = prepareFollowUpSummary(demoWorkspace, 'demo-patient-ana', range)
    expect(prepareFollowUpSummary(demoWorkspace, 'demo-patient-ana', range)).toBe(first)
    expect(first).toContain('Revisão profissional obrigatória')
    expect(first).toContain('Plano prescrito e consumo relatado permanecem separados')
  })

  it('calcula períodos inclusivos sem depender do fuso do navegador', () => {
    expect(periodRange('30', '2026-11-10')).toEqual({ start: '2026-10-12', end: '2026-11-10' })
  })
})
