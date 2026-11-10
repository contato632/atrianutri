import type { FoodItem, FoodPortion, Meal, NutrientKey, NutritionTargets } from './models'

export const nutrientKeys: NutrientKey[] = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sodiumMg']
export const nutrientLabels: Record<NutrientKey, string> = { energyKcal: 'Energia', proteinG: 'Proteínas', carbohydrateG: 'Carboidratos', fatG: 'Gorduras', fiberG: 'Fibras', sodiumMg: 'Sódio' }
export const nutrientUnits: Record<NutrientKey, string> = { energyKcal: 'kcal', proteinG: 'g', carbohydrateG: 'g', fatG: 'g', fiberG: 'g', sodiumMg: 'mg' }

export type NutrientCompleteness = 'complete' | 'partial' | 'unavailable'
export type NutritionTotals = {
  values: Record<NutrientKey, number>
  completeness: Record<NutrientKey, NutrientCompleteness>
  macroEnergyPercentages?: { protein: number; carbohydrate: number; fat: number }
  itemCount: number
  calculatedItemCount: number
}

export type PortionResolution = { valid: true; baseAmount: number; baseUnit: 'g' | 'ml'; label: string } | { valid: false; reason: string }

export function resolvePortion(food: FoodItem): PortionResolution {
  const composition = food.composition; const portion = food.portion
  if (!composition || !portion || !Number.isFinite(portion.amount) || portion.amount <= 0) return { valid: false, reason: 'Porção ou composição não informada.' }
  if (portion.unit === 'household') {
    const measure = composition.householdMeasures.find((item) => item.id === portion.measureId)
    if (!measure) return { valid: false, reason: 'Medida caseira sem equivalência validada para este alimento.' }
    return { valid: true, baseAmount: portion.amount * measure.equivalentAmount, baseUnit: measure.equivalentUnit, label: `${portion.amount.toLocaleString('pt-BR')} ${measure.label}${portion.amount === 1 ? '' : 's'} (${(portion.amount * measure.equivalentAmount).toLocaleString('pt-BR')} ${measure.equivalentUnit})` }
  }
  if (portion.unit === composition.referenceUnit) return { valid: true, baseAmount: portion.amount, baseUnit: portion.unit, label: `${portion.amount.toLocaleString('pt-BR')} ${portion.unit}` }
  if (!composition.densityGPerMl) return { valid: false, reason: 'Conversão entre gramas e mililitros indisponível: densidade não cadastrada.' }
  const baseAmount = composition.referenceUnit === 'g' ? portion.amount * composition.densityGPerMl : portion.amount / composition.densityGPerMl
  return { valid: true, baseAmount, baseUnit: composition.referenceUnit, label: `${portion.amount.toLocaleString('pt-BR')} ${portion.unit} (${baseAmount.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${composition.referenceUnit}, densidade cadastrada)` }
}

export function portionNutrition(food: FoodItem): { values: Partial<Record<NutrientKey, number>>; missing: NutrientKey[]; resolution: PortionResolution } {
  const resolution = resolvePortion(food)
  if (!resolution.valid || !food.composition) return { values: {}, missing: [...nutrientKeys], resolution }
  const factor = resolution.baseAmount / food.composition.referenceAmount
  const values: Partial<Record<NutrientKey, number>> = {}; const missing: NutrientKey[] = []
  for (const key of nutrientKeys) {
    const datum = food.composition.nutrients[key]
    if (datum.status === 'known') values[key] = datum.value * factor
    else missing.push(key)
  }
  return { values, missing, resolution }
}

export function calculateNutrition(items: FoodItem[]): NutritionTotals {
  const values = Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as Record<NutrientKey, number>
  const knownCounts = Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as Record<NutrientKey, number>
  let calculatedItemCount = 0
  for (const item of items) {
    const result = portionNutrition(item)
    if (result.resolution.valid && Object.keys(result.values).length) calculatedItemCount += 1
    for (const key of nutrientKeys) if (result.values[key] !== undefined) { values[key] += result.values[key]!; knownCounts[key] += 1 }
  }
  const completeness = Object.fromEntries(nutrientKeys.map((key) => [key, knownCounts[key] === 0 ? 'unavailable' : knownCounts[key] === items.length ? 'complete' : 'partial'])) as Record<NutrientKey, NutrientCompleteness>
  let macroEnergyPercentages: NutritionTotals['macroEnergyPercentages']
  if (items.length && ['proteinG', 'carbohydrateG', 'fatG'].every((key) => completeness[key as NutrientKey] === 'complete')) {
    const protein = values.proteinG * 4; const carbohydrate = values.carbohydrateG * 4; const fat = values.fatG * 9; const total = protein + carbohydrate + fat
    if (total > 0) macroEnergyPercentages = { protein: protein / total * 100, carbohydrate: carbohydrate / total * 100, fat: fat / total * 100 }
  }
  return { values, completeness, macroEnergyPercentages, itemCount: items.length, calculatedItemCount }
}

export const calculateMealNutrition = (meal: Meal) => calculateNutrition(meal.foods)
export const calculatePlanNutrition = (meals: Meal[]) => calculateNutrition(meals.flatMap((meal) => meal.foods))
export const compareToTarget = (value: number, target: number | undefined) => target && target > 0 ? value / target * 100 : undefined
export const normalizeTargets = (targets: NutritionTargets | undefined): NutritionTargets => Object.fromEntries(Object.entries(targets ?? {}).filter(([, value]) => Number.isFinite(value) && Number(value) > 0))

export function portionWithQuantity(portion: FoodPortion, food: FoodItem): string {
  return resolvePortion({ ...food, portion }).valid ? (resolvePortion({ ...food, portion }) as Extract<PortionResolution, { valid: true }>).label : `${portion.amount} ${portion.unit}`
}
