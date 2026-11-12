import datasetJson from '../data/scientific-food-catalog.json'
import type { CatalogFood } from './foodCatalog'
import type { NutrientDatum, NutrientKey } from './models'

export type CatalogQualityIssue = { severity: 'error' | 'warning'; code: string; foodCode?: string; message: string }
export type ScientificCatalogDataset = {
  schemaVersion: number
  source: { id: string; name: string; edition: string; publishedAt: string | null; license: string; originCountry: string; dataset: string; downloadUrl?: string | null; archiveSha256?: string | null; archiveVerified?: boolean; selectionSha256?: string; contentSha256?: string; fileChecksums?: Record<string, string>; importReport?: { selectedFoods: number; importedFoods: number; sourceRows: { foods: number; foodNutrients: number; nutrients: number }; knownNutrients: number; unavailableNutrients: number } }
  foods: CatalogFood[]
}

const nutrientKeys: NutrientKey[] = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sodiumMg']
const maximums: Record<NutrientKey, number> = { energyKcal: 1000, proteinG: 100, carbohydrateG: 100, fatG: 100, fiberG: 100, sodiumMg: 100000 }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function validateDatum(key: NutrientKey, datum: NutrientDatum | undefined, code: string, issues: CatalogQualityIssue[]) {
  if (!datum || !['known', 'not-analyzed', 'unavailable'].includes(datum.status)) { issues.push({ severity: 'error', code: 'invalid-nutrient-status', foodCode: code, message: `${key}: estado nutricional inválido.` }); return }
  if (datum.status !== 'known') return
  if (!Number.isFinite(datum.value) || datum.value < 0) issues.push({ severity: 'error', code: 'invalid-nutrient-value', foodCode: code, message: `${key}: valor negativo ou não numérico.` })
  else if (datum.value > maximums[key]) issues.push({ severity: 'warning', code: 'extreme-nutrient-value', foodCode: code, message: `${key}: valor extremo requer revisão, sem correção automática.` })
}

export function validateScientificCatalog(dataset: ScientificCatalogDataset): CatalogQualityIssue[] {
  const issues: CatalogQualityIssue[] = []
  if (dataset.schemaVersion !== 1) issues.push({ severity: 'error', code: 'schema-version', message: 'Versão de schema não suportada.' })
  if (dataset.source.id !== 'usda-fdc' || dataset.source.license !== 'CC0-1.0') issues.push({ severity: 'error', code: 'source-license', message: 'A fonte incorporável deve ser USDA FoodData Central com licença CC0-1.0 documentada.' })
  if (dataset.foods.length && (!dataset.source.downloadUrl?.startsWith('https://fdc.nal.usda.gov/') || !/^[a-f0-9]{64}$/i.test(dataset.source.archiveSha256 ?? '') || !dataset.source.publishedAt || dataset.source.archiveVerified !== true || !/^[a-f0-9]{64}$/i.test(dataset.source.selectionSha256 ?? '') || !/^[a-f0-9]{64}$/i.test(dataset.source.contentSha256 ?? '') || Object.keys(dataset.source.fileChecksums ?? {}).length !== 3)) issues.push({ severity: 'error', code: 'source-provenance', message: 'Release incorporado sem URL, hashes verificados, data ou checksums dos arquivos oficiais.' })
  if (dataset.foods.length && (dataset.source.importReport?.importedFoods !== dataset.foods.length || dataset.source.importReport.selectedFoods !== dataset.foods.length)) issues.push({ severity: 'error', code: 'import-report', message: 'Relatório de importação incompatível com o catálogo incorporado.' })
  const sourceCodes = new Set<string>(); const identities = new Set<string>()
  for (const food of dataset.foods) {
    const code = food.sourceFoodCode ?? ''
    if (food.catalogType !== 'scientific' || food.demonstrative) issues.push({ severity: 'error', code: 'catalog-separation', foodCode: code, message: 'Item científico marcado como demonstração ou tipo incorreto.' })
    if (!/^\d+$/.test(code) || food.sourceId !== dataset.source.id) issues.push({ severity: 'error', code: 'source-code', foodCode: code, message: 'Código FDC ausente ou incompatível com a fonte.' })
    if (sourceCodes.has(code)) issues.push({ severity: 'error', code: 'duplicate-source-code', foodCode: code, message: 'Código FDC duplicado.' }); sourceCodes.add(code)
    const identity = `${normalize(food.foodName)}|${normalize(food.preparation)}`
    if (identities.has(identity)) issues.push({ severity: 'warning', code: 'duplicate-food-identity', foodCode: code, message: 'Nome e preparo duplicados; revisar, sem mesclar automaticamente.' }); identities.add(identity)
    if (!food.foodName.trim() || !food.originalName?.trim() || !food.category.trim() || !food.preparation.trim()) issues.push({ severity: 'error', code: 'missing-identification', foodCode: code, message: 'Tradução, nome original, categoria e preparo são obrigatórios.' })
    if (food.referenceAmount !== 100 || food.referenceUnit !== 'g') issues.push({ severity: 'error', code: 'reference-unit', foodCode: code, message: 'O catálogo científico deve normalizar composição por 100 g.' })
    for (const key of nutrientKeys) validateDatum(key, food.nutrients[key], code, issues)
    const measureIds = new Set<string>()
    for (const measure of food.householdMeasures) { if (!measure.id.trim() || !measure.label.trim() || measureIds.has(measure.id) || measure.equivalentAmount <= 0 || !['g', 'ml'].includes(measure.equivalentUnit)) issues.push({ severity: 'error', code: 'invalid-household-measure', foodCode: code, message: `Medida ${measure.label} possui identificação ou conversão inválida.` }); measureIds.add(measure.id) }
  }
  return issues
}

const dataset = datasetJson as unknown as ScientificCatalogDataset
export const scientificCatalogIssues = validateScientificCatalog(dataset)
if (scientificCatalogIssues.some((issue) => issue.severity === 'error')) throw new Error('O catálogo científico local falhou na validação de integridade.')
export const scientificFoodCatalog = structuredClone(dataset.foods)
export const scientificCatalogMetadata = structuredClone(dataset.source)

export type ScientificCatalogSearch = { query?: string; category?: string; sort?: 'relevance' | 'name' | 'category' | 'source-code' }
export function searchCatalog(catalog: CatalogFood[], filters: ScientificCatalogSearch): CatalogFood[] {
  const query = normalize(filters.query ?? '')
  const score = (food: CatalogFood) => { if (!query) return 0; const name = normalize(food.foodName); const original = normalize(food.originalName ?? ''); const terms = food.searchTerms.map(normalize); if (name === query) return 100; if (name.startsWith(query)) return 80; if (terms.includes(query)) return 70; if (name.includes(query)) return 60; if (terms.some((term) => term.includes(query))) return 50; if (original.startsWith(query)) return 40; return 10 }
  const filtered = catalog.filter((food) => (!query || normalize([food.foodName, food.originalName, food.category, food.preparation, food.sourceFoodCode, ...food.searchTerms].join(' ')).includes(query)) && (!filters.category || food.category === filters.category))
  return filtered.sort((left, right) => filters.sort === 'source-code' ? (left.sourceFoodCode ?? '').localeCompare(right.sourceFoodCode ?? '', 'pt-BR', { numeric: true }) : filters.sort === 'category' ? left.category.localeCompare(right.category, 'pt-BR') || left.foodName.localeCompare(right.foodName, 'pt-BR') : filters.sort === 'name' ? left.foodName.localeCompare(right.foodName, 'pt-BR') : score(right) - score(left) || left.foodName.localeCompare(right.foodName, 'pt-BR'))
}
export const searchScientificCatalog = (filters: ScientificCatalogSearch) => searchCatalog(scientificFoodCatalog, filters)
