import { describe, expect, it } from 'vitest'
import { snapshotCatalogFood, type CatalogFood } from './foodCatalog'
import type { ScientificCatalogDataset } from './scientificCatalog'
import { searchCatalog, scientificFoodCatalog, validateScientificCatalog } from './scientificCatalog'

const food = (overrides: Partial<CatalogFood> = {}): CatalogFood => ({
  id: 'usda-fdc-123', foodName: 'Feijão cozido', originalName: 'Beans, cooked', category: 'Leguminosas', preparation: 'Cozido', catalogType: 'scientific', sourceFoodCode: '123', sourcePublishedAt: '2026-01-01', sourceId: 'usda-fdc', sourceName: 'USDA FoodData Central', sourceVersion: 'fixture', sourceLicense: 'CC0 1.0 Universal (CC0-1.0)', demonstrative: false, referenceAmount: 100, referenceUnit: 'g', nutrients: { energyKcal: { status: 'known', value: 100 }, proteinG: { status: 'known', value: 8 }, carbohydrateG: { status: 'known', value: 20 }, fatG: { status: 'known', value: 1 }, fiberG: { status: 'unavailable' }, sodiumMg: { status: 'not-analyzed' } }, householdMeasures: [], searchTerms: ['feijao'], substitutionIds: [], ...overrides,
})
const dataset = (foods: CatalogFood[]): ScientificCatalogDataset => ({ schemaVersion: 1, source: { id: 'usda-fdc', name: 'USDA FoodData Central', edition: 'fixture', publishedAt: '2026-01-01', license: 'CC0-1.0', originCountry: 'Estados Unidos', dataset: 'Foundation Foods', downloadUrl: 'https://fdc.nal.usda.gov/fdc-datasets/fixture.zip', archiveSha256: 'a'.repeat(64), archiveVerified: true, selectionSha256: 'b'.repeat(64), contentSha256: 'c'.repeat(64), fileChecksums: { 'food.csv': 'd'.repeat(64), 'food_nutrient.csv': 'e'.repeat(64), 'nutrient.csv': 'f'.repeat(64) }, importReport: { selectedFoods: foods.length, importedFoods: foods.length, sourceRows: { foods: foods.length, foodNutrients: foods.length, nutrients: 6 }, knownNutrients: 0, unavailableNutrients: 0 } }, foods })

describe('catálogo científico rastreável', () => {
  it('mantém o artefato clínico vazio enquanto nenhuma fonte oficial foi incorporada', () => expect(scientificFoodCatalog).toHaveLength(0))
  it('aceita um conjunto rastreável com hashes e relatório coerentes', () => expect(validateScientificCatalog(dataset([food()])).filter((issue) => issue.severity === 'error')).toEqual([]))
  it('rejeita valor negativo, código duplicado e mistura com demonstração', () => {
    const invalid = food({ demonstrative: true, catalogType: 'demonstration', nutrients: { ...food().nutrients, proteinG: { status: 'known', value: -1 } } })
    const issues = validateScientificCatalog(dataset([invalid, food()]))
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['catalog-separation', 'invalid-nutrient-value', 'duplicate-source-code', 'duplicate-food-identity']))
  })
  it('rejeita licença incompatível e proveniência oficial incompleta', () => {
    const invalid = dataset([food()]); invalid.source = { ...invalid.source, license: 'proprietária', downloadUrl: 'https://example.com/base.zip', archiveSha256: null }
    expect(validateScientificCatalog(invalid).map((issue) => issue.code)).toEqual(expect.arrayContaining(['source-license', 'source-provenance']))
  })
  it('sinaliza valores extremos sem corrigi-los automaticamente', () => {
    const extreme = food({ nutrients: { ...food().nutrients, sodiumMg: { status: 'known', value: 120000 } } })
    expect(validateScientificCatalog(dataset([extreme]))).toContainEqual(expect.objectContaining({ severity: 'warning', code: 'extreme-nutrient-value' }))
    expect(extreme.nutrients.sodiumMg).toEqual({ status: 'known', value: 120000 })
  })
  it('pesquisa tradução, nome original e categoria com filtros e ordenação', () => {
    const apple = food({ id: 'usda-fdc-9', sourceFoodCode: '9', foodName: 'Maçã crua', originalName: 'Apple, raw', category: 'Frutas', preparation: 'Crua', searchTerms: ['fruta fresca'] })
    expect(searchCatalog([food(), apple], { query: 'apple' }).map((item) => item.sourceFoodCode)).toEqual(['9'])
    expect(searchCatalog([food(), apple], { query: 'fruta fresca' })).toEqual([apple])
    expect(searchCatalog([food(), apple], { category: 'Frutas', sort: 'source-code' })).toEqual([apple])
  })

  it('prioriza correspondência exata e prefixo antes de ocorrências secundárias', () => {
    const exact = food({ id: 'exact', sourceFoodCode: '1', foodName: 'Arroz', originalName: 'Rice', searchTerms: [] })
    const secondary = food({ id: 'secondary', sourceFoodCode: '2', foodName: 'Preparação com arroz', originalName: 'Dish', searchTerms: ['arroz'] })
    expect(searchCatalog([secondary, exact], { query: 'arroz', sort: 'relevance' })).toEqual([exact, secondary])
  })

  it('preserva a composição e a origem no snapshot sem referências mutáveis ao catálogo', () => {
    const original = food(); const snapshot = snapshotCatalogFood(original)
    original.nutrients.energyKcal = { status: 'known', value: 999 }
    expect(snapshot).toEqual(expect.objectContaining({ sourceFoodCode: '123', sourceVersion: 'fixture', sourceLicense: 'CC0 1.0 Universal (CC0-1.0)' }))
    expect(snapshot.nutrients.energyKcal).toEqual({ status: 'known', value: 100 })
  })

  it('rejeita relatório divergente e medidas caseiras duplicadas', () => {
    const invalid = dataset([food({ householdMeasures: [{ id: 'colher', label: 'Colher', equivalentAmount: 10, equivalentUnit: 'g' }, { id: 'colher', label: 'Colher repetida', equivalentAmount: 12, equivalentUnit: 'g' }] })])
    invalid.source.importReport = { ...invalid.source.importReport!, importedFoods: 2 }
    expect(validateScientificCatalog(invalid).map((issue) => issue.code)).toEqual(expect.arrayContaining(['import-report', 'invalid-household-measure']))
  })
})
