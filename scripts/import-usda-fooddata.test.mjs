import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { importUsdaFoodData, parseCsv } from './import-usda-fooddata.mjs'

let temporary
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); temporary = undefined })

describe('importador USDA FoodData Central', () => {
  it('interpreta CSV com vírgulas e aspas', () => expect(parseCsv('id,description\r\n1,"Food, cooked"\r\n')).toEqual([{ id: '1', description: 'Food, cooked' }]))

  it('gera snapshot rastreável e mantém nutriente ausente', async () => {
    temporary = await mkdtemp(join(tmpdir(), 'atrianutri-usda-'))
    await writeFile(join(temporary, 'food.csv'), 'fdc_id,data_type,description\n123,foundation_food,"Bean, cooked"\n')
    await writeFile(join(temporary, 'nutrient.csv'), 'id,name,unit_name\n1008,Energy,KCAL\n1003,Protein,G\n')
    await writeFile(join(temporary, 'food_nutrient.csv'), 'fdc_id,nutrient_id,amount\n123,1008,120\n123,1003,8.5\n')
    const selection = join(temporary, 'selection.json')
    await writeFile(selection, JSON.stringify({ schemaVersion: 1, source: { dataset: 'Foundation Foods', license: 'CC0-1.0', originCountry: 'Estados Unidos' }, release: 'teste-oficial-fixture', publishedAt: '2026-01-01', downloadUrl: 'https://fdc.nal.usda.gov/fdc-datasets/fixture.zip', archiveSha256: 'a'.repeat(64), foods: [{ fdcId: 123, namePt: 'Feijão de teste', categoryPt: 'Leguminosas', preparationPt: 'Cozido' }] }))
    const output = await importUsdaFoodData({ inputDirectory: temporary, selectionPath: selection })
    expect(output.foods[0]).toEqual(expect.objectContaining({ sourceFoodCode: '123', originalName: 'Bean, cooked', sourceLicense: 'CC0 1.0 Universal (CC0-1.0)' }))
    expect(output.foods[0].nutrients.energyKcal).toEqual({ status: 'known', value: 120 })
    expect(output.foods[0].nutrients.sodiumMg).toEqual({ status: 'unavailable' })
    expect(output.source.fileChecksums['food.csv']).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejeita unidades incompatíveis sem corrigir dados', async () => {
    temporary = await mkdtemp(join(tmpdir(), 'atrianutri-usda-'))
    await writeFile(join(temporary, 'food.csv'), 'fdc_id,data_type,description\n123,foundation_food,Food\n')
    await writeFile(join(temporary, 'nutrient.csv'), 'id,name,unit_name\n1008,Energy,KJ\n')
    await writeFile(join(temporary, 'food_nutrient.csv'), 'fdc_id,nutrient_id,amount\n123,1008,500\n')
    const selection = join(temporary, 'selection.json')
    await writeFile(selection, JSON.stringify({ schemaVersion: 1, source: { dataset: 'Foundation Foods', license: 'CC0-1.0', originCountry: 'Estados Unidos' }, release: 'fixture', publishedAt: '2026-01-01', downloadUrl: 'https://fdc.nal.usda.gov/fdc-datasets/fixture.zip', archiveSha256: 'b'.repeat(64), foods: [{ fdcId: 123, namePt: 'Teste', categoryPt: 'Teste', preparationPt: 'Cozido' }] }))
    await expect(importUsdaFoodData({ inputDirectory: temporary, selectionPath: selection })).rejects.toThrow('incompatível')
  })
})
