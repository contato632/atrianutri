import { describe, expect, it } from 'vitest'
import { demoWorkspace } from '../data/demo-data'
import { buildNutritionPdf } from '../lib/nutritionPdf'
import { buildNutritionDocument, defaultDocumentOptions, resolvePlanMeals, type NutritionDocumentType } from './documents'

const branding = { clinicName: 'Clínica Fictícia', professionalName: 'Dra. Marina Costa', crn: 'CRN-5 00000', headerText: 'Documento de teste', footerText: 'Dados exclusivamente fictícios.', primaryColor: '#176fa5' }

function options(type: NutritionDocumentType) {
  const value = defaultDocumentOptions(type, 'demo-patient-ana', branding.professionalName)
  value.branding = branding
  value.evaluationId = 'evaluation-ana-1'
  value.planId = 'plan-ana'
  value.planVersion = 2
  return value
}

describe('documentos nutricionais', () => {
  it('monta os quatro documentos apenas com registros existentes', () => {
    for (const type of ['evaluation', 'evolution', 'meal-plan', 'follow-up'] as const) {
      const document = buildNutritionDocument(demoWorkspace, options(type))
      expect(document.type).toBe(type)
      expect(document.patientName).toBe('Ana Beatriz Lima')
      expect(document.blocks.length).toBeGreaterThan(1)
    }
  })

  it('exclui notas privadas por padrão e deixa observações profissionais desmarcadas', () => {
    const value = options('evaluation')
    expect(value.sections).not.toContain('professional-observations')
    const serialized = JSON.stringify(buildNutritionDocument(demoWorkspace, value))
    expect(serialized).not.toContain('Observar regularidade em dias de trabalho presencial')
    expect(serialized).not.toContain('Rotina de trabalho com horários variáveis')
    expect(serialized).toContain('Informações de saúde fictícias')
  })

  it('respeita o conteúdo da versão selecionada do plano', () => {
    const versionOne = resolvePlanMeals(demoWorkspace, 'plan-ana', 1)
    const versionTwo = resolvePlanMeals(demoWorkspace, 'plan-ana', 2)
    expect(versionOne.version).toBe(1)
    expect(versionOne.meals).toHaveLength(1)
    expect(versionTwo.meals).toHaveLength(2)
    const value = options('meal-plan'); value.planVersion = 1
    expect(JSON.stringify(buildNutritionDocument(demoWorkspace, value))).not.toContain('Almoço')
  })

  it('exige identificação profissional e CRN', () => {
    const value = options('follow-up'); value.branding = { ...branding, crn: '' }
    expect(() => buildNutritionDocument(demoWorkspace, value)).toThrow('CRN')
  })

  it('gera PDF A4 válido com paginação e gráfico sem serviço externo', () => {
    const document = buildNutritionDocument(demoWorkspace, options('evolution'))
    const pdf = buildNutritionPdf(document)
    const bytes = new Uint8Array(pdf.output('arraybuffer'))
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF')
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 0)
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 0)
  })

  it('pagina conteúdo extenso sem depender da impressão do navegador', () => {
    const value = options('evaluation')
    value.introduction = 'Contexto registrado pelo profissional. '.repeat(180)
    value.closingNotes = 'Observação final revisada. '.repeat(180)
    const pdf = buildNutritionPdf(buildNutritionDocument(demoWorkspace, value))
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2)
  })
})
