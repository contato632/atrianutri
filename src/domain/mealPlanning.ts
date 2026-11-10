import { catalogFoodById, snapshotCatalogFood, type CatalogFood } from './foodCatalog'
import type { ApprovedFoodSubstitution, FoodItem, FoodPortion } from './models'
import { portionNutrition, resolvePortion } from './nutritionCalculation'

export const createCatalogFoodItem = (food: CatalogFood, id: string, portion?: FoodPortion): FoodItem => {
  const selectedPortion = portion ?? (food.householdMeasures[0] ? { amount: 1, unit: 'household', measureId: food.householdMeasures[0].id } : { amount: food.referenceAmount, unit: food.referenceUnit })
  const item: FoodItem = { id, name: food.foodName, quantity: '', catalogFoodId: food.id, portion: selectedPortion, composition: snapshotCatalogFood(food) }
  const resolution = resolvePortion(item)
  return { ...item, quantity: resolution.valid ? resolution.label : `${selectedPortion.amount} ${selectedPortion.unit}` }
}

export type SubstitutionComparison = {
  original: FoodItem
  alternative: CatalogFood
  replacement: FoodItem
  criterion: string
  energyDifference?: number
  proteinDifference?: number
}

export function substitutionComparisons(original: FoodItem): SubstitutionComparison[] {
  if (!original.catalogFoodId) return []
  const catalog = catalogFoodById(original.catalogFoodId)
  if (!catalog) return []
  const resolution = resolvePortion(original)
  if (!resolution.valid) return []
  return catalog.substitutionIds.flatMap((id) => {
    const alternative = catalogFoodById(id)
    if (!alternative || alternative.referenceUnit !== resolution.baseUnit) return []
    const replacement = createCatalogFoodItem(alternative, original.id, { amount: resolution.baseAmount, unit: resolution.baseUnit })
    const before = portionNutrition(original).values; const after = portionNutrition(replacement).values
    return [{ original, alternative, replacement, criterion: `Mesma quantidade base (${resolution.baseAmount.toLocaleString('pt-BR')} ${resolution.baseUnit}); comparação informativa, sem equivalência clínica.`, energyDifference: before.energyKcal === undefined || after.energyKcal === undefined ? undefined : after.energyKcal - before.energyKcal, proteinDifference: before.proteinG === undefined || after.proteinG === undefined ? undefined : after.proteinG - before.proteinG }]
  })
}

export function approveSubstitution(comparison: SubstitutionComparison, approvedAt = new Date().toISOString()): FoodItem {
  const approval: ApprovedFoodSubstitution = { originalCatalogFoodId: comparison.original.catalogFoodId!, originalName: comparison.original.name, replacementCatalogFoodId: comparison.alternative.id, replacementName: comparison.alternative.foodName, criterion: comparison.criterion, approvedAt }
  return { ...comparison.replacement, approvedSubstitution: approval }
}
