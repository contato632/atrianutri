import { describe, expect, it } from 'vitest'
import type { CatalogFood } from './foodCatalog'
import type { ScientificCatalogDataset } from './scientificCatalog'
import { searchCatalog, scientificFoodCatalog, validateScientificCatalog } from './scientificCatalog'

const food = (overrides: Partial<CatalogFood> = {}): CatalogFood => ({
  id: 'usda-fdc-123', foodName: 'Feijão cozido', originalName: 'Beans, cooked', category: 'Leguminosas', preparation: 'Cozido', catalogType: 'scientific', sourceFoodCode: '123', sourcePublishedAt: '2026-01-01', sourceId: 'usda-fdc', sourceName: 'USDA FoodData Central', sourceVersion: 'fixture', sourceLicense: 'CC0 1.0 Universal (CC0-1.0)', demonstrative: false, referenceAmount: 100, referenceUnit: 'g', nutrients: { energyKcal: { status: 'known', value: 100 }, proteinG: { status: 'known', value: 8 }, carbohydrateG: { status: 'known', value: 20 }, fatG: { status: 'known', value: 1 }, fiberG: { status: 'unavailable' }, sodiumMg: { status: 'not-analyzed' } }, householdMeasures: [], searchTerms: ['feijao'], substitutionIds: [], ...overrides,
})
const dataset = (foods: CatalogFood[]): ScientificCatalogDataset => ({ schemaVersion: 1, source: { id: 'usda-fdc', name: 'USDA FoodData Central', edition: 'fixture', publishedAt: '2026-01-01', license: 'CC0-1.0', originCountry: 'Estados Unidos', dataset: 'Foundation Foods' }, foods })

describe('catálogo científico rastreável', () => {
  it('mantém o artefato clínico vazio enquanto nenhuma fonte oficial foi incorporada', () => expect(scientificFoodCatalog).toHaveLength(0))
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
    const apple = food({ id: 'usda-fdc-9', sourceFoodCode: '9', foodName: 'Maçã crua', originalName: 'Apple, raw', category: 'Frutas', preparation: 'Crua' })
    expect(searchCatalog([food(), apple], { query: 'apple' }).map((item) => item.sourceFoodCode)).toEqual(['9'])
    expect(searchCatalog([food(), apple], { category: 'Frutas', sort: 'source-code' })).toEqual([apple])
  })
})
