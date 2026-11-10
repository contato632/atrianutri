import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const nutrientMap = {
  '1008': ['energyKcal', 'KCAL'],
  '1003': ['proteinG', 'G'],
  '1005': ['carbohydrateG', 'G'],
  '1004': ['fatG', 'G'],
  '1079': ['fiberG', 'G'],
  '1093': ['sodiumMg', 'MG'],
}

export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(field); if (row.some((value) => value !== '')) rows.push(row); row = []; field = '' }
    else field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [headers = [], ...data] = rows
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ''), values[index] ?? ''])))
}

const readCsv = async (directory, name) => parseCsv(await readFile(resolve(directory, name), 'utf8'))
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
const datum = (value) => value === undefined ? { status: 'unavailable' } : { status: 'known', value }

export async function importUsdaFoodData({ inputDirectory, selectionPath }) {
  const selection = JSON.parse(await readFile(selectionPath, 'utf8'))
  if (selection.schemaVersion !== 1 || selection.source?.license !== 'CC0-1.0' || selection.source?.dataset !== 'Foundation Foods') throw new Error('O manifesto deve declarar Foundation Foods e CC0-1.0.')
  if (!selection.release || !/^\d{4}-\d{2}-\d{2}$/.test(selection.publishedAt) || !selection.downloadUrl?.startsWith('https://fdc.nal.usda.gov/') || !/^[a-f0-9]{64}$/i.test(selection.archiveSha256 ?? '')) throw new Error('Informe release, data, URL oficial e SHA-256 do arquivo no manifesto antes de importar.')
  const selectedCodes = selection.foods.map((food) => String(food.fdcId))
  if (new Set(selectedCodes).size !== selectedCodes.length) throw new Error('O manifesto contém códigos FDC duplicados.')
  const [foods, foodNutrients, nutrients] = await Promise.all([readCsv(inputDirectory, 'food.csv'), readCsv(inputDirectory, 'food_nutrient.csv'), readCsv(inputDirectory, 'nutrient.csv')])
  const foodById = new Map(foods.map((food) => [food.fdc_id, food]))
  const nutrientById = new Map(nutrients.map((nutrient) => [nutrient.id, nutrient]))
  const amounts = new Map()
  for (const row of foodNutrients) {
    if (!selectedCodes.includes(row.fdc_id) || !nutrientMap[row.nutrient_id]) continue
    const value = Number(row.amount)
    if (!Number.isFinite(value) || value < 0) throw new Error(`Valor nutricional inválido no FDC ${row.fdc_id}, nutriente ${row.nutrient_id}.`)
    const [, expectedUnit] = nutrientMap[row.nutrient_id]; const unit = nutrientById.get(row.nutrient_id)?.unit_name?.toUpperCase()
    if (unit !== expectedUnit) throw new Error(`Unidade ${unit || 'ausente'} incompatível no nutriente ${row.nutrient_id}; esperado ${expectedUnit}.`)
    const nutrientKey = `${row.fdc_id}:${row.nutrient_id}`
    if (amounts.has(nutrientKey)) throw new Error(`Nutriente ${row.nutrient_id} duplicado no FDC ${row.fdc_id}; revisão manual necessária.`)
    amounts.set(nutrientKey, value)
  }
  const imported = selection.foods.map((reviewed) => {
    const code = String(reviewed.fdcId); const source = foodById.get(code)
    if (!source) throw new Error(`FDC ${code} não encontrado em food.csv.`)
    if (source.data_type !== 'foundation_food') throw new Error(`FDC ${code} não pertence ao conjunto Foundation Foods.`)
    if (!reviewed.namePt?.trim() || !reviewed.categoryPt?.trim() || !reviewed.preparationPt?.trim()) throw new Error(`FDC ${code} não possui tradução revisada completa.`)
    const nutrientsOutput = Object.fromEntries(Object.entries(nutrientMap).map(([nutrientId, [key]]) => [key, datum(amounts.get(`${code}:${nutrientId}`))]))
    return {
      id: `usda-fdc-${code}`, foodName: reviewed.namePt.trim(), originalName: source.description.trim(), category: reviewed.categoryPt.trim(), preparation: reviewed.preparationPt.trim(),
      catalogType: 'scientific', sourceFoodCode: code, sourcePublishedAt: selection.publishedAt, sourceId: 'usda-fdc', sourceName: 'USDA FoodData Central', sourceVersion: selection.release,
      sourceLicense: 'CC0 1.0 Universal (CC0-1.0)', demonstrative: false, referenceAmount: 100, referenceUnit: 'g', nutrients: nutrientsOutput,
      householdMeasures: reviewed.householdMeasures ?? [], searchTerms: reviewed.searchTerms ?? [], substitutionIds: [],
    }
  }).sort((left, right) => Number(left.sourceFoodCode) - Number(right.sourceFoodCode))
  const fileChecksums = Object.fromEntries(await Promise.all(['food.csv', 'food_nutrient.csv', 'nutrient.csv'].map(async (name) => [name, await sha256(resolve(inputDirectory, name))])))
  return { schemaVersion: 1, source: { id: 'usda-fdc', name: 'USDA FoodData Central', edition: selection.release, publishedAt: selection.publishedAt, license: 'CC0-1.0', originCountry: selection.source.originCountry, dataset: selection.source.dataset, downloadUrl: selection.downloadUrl, archiveSha256: selection.archiveSha256.toLowerCase(), fileChecksums }, foods: imported }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => value.startsWith('--') ? [value.slice(2), all[index + 1]] : null).filter(Boolean))
  if (!args.input || !args.selection || !args.output) throw new Error('Uso: --input <diretório CSV oficial> --selection <manifesto revisado> --output <arquivo JSON>.')
  const output = await importUsdaFoodData({ inputDirectory: args.input, selectionPath: args.selection })
  await writeFile(args.output, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  process.stdout.write(`Importados ${output.foods.length} alimentos USDA rastreáveis.\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
