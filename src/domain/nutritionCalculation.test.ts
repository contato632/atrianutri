import { describe, expect, it } from 'vitest'
import { catalogFoodById } from './foodCatalog'
import { approveSubstitution, createCatalogFoodItem, substitutionComparisons } from './mealPlanning'
import type { FoodCompositionSnapshot, FoodItem, Meal, NutrientKey } from './models'
import { calculateMealNutrition, calculatePlanNutrition, portionNutrition, resolvePortion } from './nutritionCalculation'

const item = (id: string, amount: number, unit: 'g' | 'ml' = 'g') => createCatalogFoodItem(catalogFoodById(id)!, `item-${id}`, { amount, unit })

describe('motor determinístico de composição nutricional', () => {
  it('calcula nutrientes proporcionalmente à porção', () => {
    const result = portionNutrition(item('demo-banana', 50))
    expect(result.values.energyKcal).toBeCloseTo(45)
    expect(result.values.carbohydrateG).toBeCloseTo(11.5)
  })

  it('converte apenas medidas vinculadas ou unidades com densidade cadastrada', () => {
    const banana = createCatalogFoodItem(catalogFoodById('demo-banana')!, 'banana', { amount: 2, unit: 'household', measureId: 'unit-medium' })
    expect(resolvePortion(banana)).toEqual(expect.objectContaining({ valid: true, baseAmount: 170, baseUnit: 'g' }))
    expect(resolvePortion(item('demo-rice', 100, 'ml'))).toEqual(expect.objectContaining({ valid: false }))
    expect(resolvePortion(item('demo-milk', 100, 'g'))).toEqual(expect.objectContaining({ valid: true, baseUnit: 'ml' }))
  })

  it('mantém zero conhecido distinto de dado não analisado ou indisponível', () => {
    const oil = portionNutrition(item('demo-oil', 10, 'ml'))
    expect(oil.values.proteinG).toBe(0)
    expect(oil.missing).toContain('sodiumMg')
    const mixed = calculatePlanNutrition([{ id: 'm', name: 'Refeição', time: '12:00', guidance: '', foods: [item('demo-banana', 100), item('demo-milk', 100, 'ml')] }])
    expect(mixed.completeness.fiberG).toBe('partial')
    expect(mixed.completeness.energyKcal).toBe('complete')
  })

  it('soma por refeição e por plano e calcula percentuais de macronutrientes', () => {
    const breakfast: Meal = { id: 'breakfast', name: 'Café', time: '08:00', guidance: '', foods: [item('demo-banana', 100)] }
    const lunch: Meal = { id: 'lunch', name: 'Almoço', time: '12:00', guidance: '', foods: [item('demo-rice', 100), item('demo-beans', 100)] }
    expect(calculateMealNutrition(lunch).values.energyKcal).toBeCloseTo(206)
    const plan = calculatePlanNutrition([breakfast, lunch])
    expect(plan.values.energyKcal).toBeCloseTo(296)
    expect(plan.macroEnergyPercentages?.carbohydrate).toBeGreaterThan(70)
  })

  it('calcula alimento personalizado somente com valores explicitamente informados', () => {
    const unavailable = { status: 'unavailable' as const }
    const known = (value: number) => ({ status: 'known' as const, value })
    const nutrients = { energyKcal: known(200), proteinG: known(10), carbohydrateG: known(20), fatG: known(8), fiberG: unavailable, sodiumMg: unavailable } satisfies Record<NutrientKey, FoodCompositionSnapshot['nutrients'][NutrientKey]>
    const custom: FoodItem = { id: 'custom', name: 'Preparação própria', quantity: '30 g', portion: { amount: 30, unit: 'g' }, composition: { foodName: 'Preparação própria', category: 'Personalizado', preparation: 'Manual', sourceId: 'professional-custom', sourceName: 'Cadastro profissional', sourceVersion: 'Snapshot', sourceLicense: 'Responsabilidade profissional', demonstrative: false, referenceAmount: 100, referenceUnit: 'g', nutrients, householdMeasures: [] } }
    const result = portionNutrition(custom)
    expect(result.values.energyKcal).toBeCloseTo(60)
    expect(result.values.fiberG).toBeUndefined()
  })
})

describe('substituições alimentares', () => {
  it('compara sem alterar o item e só substitui após confirmação explícita', () => {
    const original = item('demo-banana', 100)
    const comparisons = substitutionComparisons(original)
    expect(comparisons[0].criterion).toContain('sem equivalência clínica')
    expect(original.name).toContain('Banana')
    const replacement = approveSubstitution(comparisons[0], '2026-11-09T12:00:00Z')
    expect(replacement.name).toContain('Maçã')
    expect(replacement.approvedSubstitution).toEqual(expect.objectContaining({ originalName: original.name, approvedAt: '2026-11-09T12:00:00Z' }))
  })
})
