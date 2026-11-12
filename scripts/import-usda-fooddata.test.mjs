import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { importUsdaFoodData, parseCsv, verifyCatalogContentHash } from './import-usda-fooddata.mjs'

let temporary
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); temporary = undefined })
const hash = (value) => createHash('sha256').update(value).digest('hex')
async function archiveFixture(contents = 'arquivo oficial de teste') { const path = join(temporary, 'official.zip'); await writeFile(path, contents); return { path, sha256: hash(contents) } }

describe('importador USDA FoodData Central', () => {
  it('interpreta CSV com vírgulas e aspas', () => expect(parseCsv('id,description\r\n1,"Food, cooked"\r\n')).toEqual([{ id: '1', description: 'Food, cooked' }]))
  it('rejeita CSV estruturalmente malformado', () => expect(() => parseCsv('id,description\n1,"campo aberto')).toThrow('não foi encerrado'))

  it('gera snapshot rastreável e mantém nutriente ausente', async () => {
    temporary = await mkdtemp(join(tmpdir(), 'atrianutri-usda-'))
    await writeFile(join(temporary, 'food.csv'), 'fdc_id,data_type,description\n123,foundation_food,"Bean, cooked"\n')
    await writeFile(join(temporary, 'nutrient.csv'), 'id,name,unit_name\n1008,Energy,KCAL\n1003,Protein,G\n')
    await writeFile(join(temporary, 'food_nutrient.csv'), 'fdc_id,nutrient_id,amount\n123,1008,120\n123,1003,8.5\n')
    const archive = await archiveFixture()
    const selection = join(temporary, 'selection.json')
    await writeFile(selection, JSON.stringify({ schemaVersion: 1, source: { dataset: 'Foundation Foods', license: 'CC0-1.0', originCountry: 'Estados Unidos' }, release: 'teste-oficial-fixture', publishedAt: '2026-01-01', downloadUrl: 'https://fdc.nal.usda.gov/fdc-datasets/fixture.zip', archiveSha256: archive.sha256, foods: [{ fdcId: 123, namePt: 'Feijão de teste', categoryPt: 'Leguminosas', preparationPt: 'Cozido', searchTerms: ['feijao'], householdMeasures: [{ id: 'concha', label: 'Concha revisada', equivalentAmount: 90, equivalentUnit: 'g' }] }] }))
    const output = await importUsdaFoodData({ inputDirectory: temporary, selectionPath: selection, archivePath: archive.path })
    expect(output.foods[0]).toEqual(expect.objectContaining({ sourceFoodCode: '123', originalName: 'Bean, cooked', sourceLicense: 'CC0 1.0 Universal (CC0-1.0)' }))
    expect(output.foods[0].nutrients.energyKcal).toEqual({ status: 'known', value: 120 })
    expect(output.foods[0].nutrients.sodiumMg).toEqual({ status: 'unavailable' })
    expect(output.source.fileChecksums['food.csv']).toMatch(/^[a-f0-9]{64}$/)
    expect(output.source).toEqual(expect.objectContaining({ archiveVerified: true, contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/), selectionSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }))
    expect(output.source.importReport).toEqual(expect.objectContaining({ selectedFoods: 1, importedFoods: 1, knownNutrients: 2, unavailableNutrients: 4 }))
    expect(verifyCatalogContentHash(output)).toBe(true)
    expect(verifyCatalogContentHash({ ...output, foods: [{ ...output.foods[0], foodName: 'Conteúdo alterado' }] })).toBe(false)
  })

  it('rejeita unidades incompatíveis sem corrigir dados', async () => {
    temporary = await mkdtemp(join(tmpdir(), 'atrianutri-usda-'))
    await writeFile(join(temporary, 'food.csv'), 'fdc_id,data_type,description\n123,foundation_food,Food\n')
    await writeFile(join(temporary, 'nutrient.csv'), 'id,name,unit_name\n1008,Energy,KJ\n')
    await writeFile(join(temporary, 'food_nutrient.csv'), 'fdc_id,nutrient_id,amount\n123,1008,500\n')
    const archive = await archiveFixture('segunda fixture')
    const selection = join(temporary, 'selection.json')
    await writeFile(selection, JSON.stringify({ schemaVersion: 1, source: { dataset: 'Foundation Foods', license: 'CC0-1.0', originCountry: 'Estados Unidos' }, release: 'fixture', publishedAt: '2026-01-01', downloadUrl: 'https://fdc.nal.usda.gov/fdc-datasets/fixture.zip', archiveSha256: archive.sha256, foods: [{ fdcId: 123, namePt: 'Teste', categoryPt: 'Teste', preparationPt: 'Cozido' }] }))
    await expect(importUsdaFoodData({ inputDirectory: temporary, selectionPath: selection, archivePath: archive.path })).rejects.toThrow('incompatível')
  })

  it('interrompe quando o arquivo original não corresponde ao hash revisado', async () => {
    temporary = await mkdtemp(join(tmpdir(), 'atrianutri-usda-'))
    const archive = await archiveFixture('conteúdo divergente')
    const selection = join(temporary, 'selection.json')
    await writeFile(selection, JSON.stringify({ schemaVersion: 1, source: { dataset: 'Foundation Foods', license: 'CC0-1.0' }, release: 'fixture', publishedAt: '2026-01-01', downloadUrl: 'https://fdc.nal.usda.gov/fdc-datasets/fixture.zip', archiveSha256: 'a'.repeat(64), foods: [{ fdcId: 123 }] }))
    await expect(importUsdaFoodData({ inputDirectory: temporary, selectionPath: selection, archivePath: archive.path })).rejects.toThrow('não corresponde')
  })
})
