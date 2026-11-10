import type { FoodCompositionSnapshot, NutrientDatum, NutrientKey } from './models'

export type CatalogFood = FoodCompositionSnapshot & {
  id: string
  searchTerms: string[]
  substitutionIds: string[]
}

const known = (value: number): NutrientDatum => ({ status: 'known', value })
const unavailable = (): NutrientDatum => ({ status: 'unavailable' })
const notAnalyzed = (): NutrientDatum => ({ status: 'not-analyzed' })
const source = {
  sourceId: 'atria-demo-2026', sourceName: 'Catálogo demonstrativo AtriaNutri', sourceVersion: '1.0',
  sourceLicense: 'Conteúdo fictício criado para demonstração; não utilizar como referência científica ou clínica.', demonstrative: true,
} as const
const nutrients = (energyKcal: number, proteinG: number, carbohydrateG: number, fatG: number, fiberG: NutrientDatum, sodiumMg: NutrientDatum): Record<NutrientKey, NutrientDatum> => ({
  energyKcal: known(energyKcal), proteinG: known(proteinG), carbohydrateG: known(carbohydrateG), fatG: known(fatG), fiberG, sodiumMg,
})

export const demoFoodCatalog: CatalogFood[] = [
  { id: 'demo-banana', foodName: 'Banana demonstrativa', category: 'Frutas', preparation: 'In natura', ...source, referenceAmount: 100, referenceUnit: 'g', nutrients: nutrients(90, 1.1, 23, .3, known(2.4), known(1)), householdMeasures: [{ id: 'unit-medium', label: 'Unidade média', equivalentAmount: 85, equivalentUnit: 'g' }], searchTerms: ['banana', 'fruta'], substitutionIds: ['demo-apple'] },
  { id: 'demo-apple', foodName: 'Maçã demonstrativa', category: 'Frutas', preparation: 'In natura', ...source, referenceAmount: 100, referenceUnit: 'g', nutrients: nutrients(54, .3, 14.5, .2, known(2), known(1)), householdMeasures: [{ id: 'unit-medium', label: 'Unidade média', equivalentAmount: 130, equivalentUnit: 'g' }], searchTerms: ['maca', 'maçã', 'fruta'], substitutionIds: ['demo-banana'] },
  { id: 'demo-rice', foodName: 'Arroz demonstrativo', category: 'Cereais', preparation: 'Cozido', ...source, referenceAmount: 100, referenceUnit: 'g', nutrients: nutrients(128, 2.5, 28, .2, known(1.4), notAnalyzed()), householdMeasures: [{ id: 'tablespoon', label: 'Colher de sopa', equivalentAmount: 25, equivalentUnit: 'g' }, { id: 'cup', label: 'Xícara', equivalentAmount: 160, equivalentUnit: 'g' }], searchTerms: ['arroz', 'cereal'], substitutionIds: ['demo-beans'] },
  { id: 'demo-beans', foodName: 'Feijão demonstrativo', category: 'Leguminosas', preparation: 'Cozido', ...source, referenceAmount: 100, referenceUnit: 'g', nutrients: nutrients(78, 4.8, 14, .5, known(7), known(2)), householdMeasures: [{ id: 'ladle', label: 'Concha', equivalentAmount: 90, equivalentUnit: 'g' }], searchTerms: ['feijao', 'feijão', 'leguminosa'], substitutionIds: ['demo-rice'] },
  { id: 'demo-milk', foodName: 'Bebida láctea demonstrativa', category: 'Bebidas', preparation: 'Líquida', ...source, referenceAmount: 100, referenceUnit: 'ml', densityGPerMl: 1.03, nutrients: nutrients(61, 3.1, 4.8, 3.2, unavailable(), known(45)), householdMeasures: [{ id: 'cup', label: 'Xícara', equivalentAmount: 200, equivalentUnit: 'ml' }], searchTerms: ['leite', 'bebida', 'lactea'], substitutionIds: [] },
  { id: 'demo-oil', foodName: 'Óleo culinário demonstrativo', category: 'Óleos e gorduras', preparation: 'Líquido', ...source, referenceAmount: 100, referenceUnit: 'ml', densityGPerMl: .91, nutrients: nutrients(810, 0, 0, 90, known(0), notAnalyzed()), householdMeasures: [{ id: 'tablespoon', label: 'Colher de sopa', equivalentAmount: 13, equivalentUnit: 'ml' }, { id: 'teaspoon', label: 'Colher de chá', equivalentAmount: 5, equivalentUnit: 'ml' }], searchTerms: ['oleo', 'óleo', 'gordura'], substitutionIds: [] },
]

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function searchFoodCatalog(query: string, catalog = demoFoodCatalog): CatalogFood[] {
  const term = normalize(query)
  if (!term) return catalog.slice(0, 6)
  return catalog.filter((food) => normalize([food.foodName, food.category, food.preparation, ...food.searchTerms].join(' ')).includes(term))
}

export function snapshotCatalogFood(food: CatalogFood): FoodCompositionSnapshot {
  const { id: _id, searchTerms: _searchTerms, substitutionIds: _substitutionIds, ...snapshot } = food
  return structuredClone(snapshot)
}

export function catalogFoodById(id: string, catalog = demoFoodCatalog) {
  return catalog.find((food) => food.id === id)
}
