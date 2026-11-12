import { expect, test, type Page } from '@playwright/test'

const widths = [360, 390, 430, 768, 1024]

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('mantém o paciente selecionado entre os módulos clínicos', async ({ page }) => {
  await page.goto('/pacientes')
  await page.locator('.patient-row__main').filter({ hasText: 'Ana Beatriz Lima' }).click()
  await expect(page.getByText('Paciente em contexto')).toBeVisible()
  await page.getByRole('navigation', { name: 'Atalhos clínicos' }).getByRole('link', { name: 'Avaliações' }).click()
  await expect(page.getByLabel('Selecionar paciente')).toHaveValue('demo-patient-ana')
  await page.getByRole('navigation', { name: 'Atalhos clínicos' }).getByRole('link', { name: 'Plano' }).click()
  await expect(page.locator('.plan-toolbar select').first()).toHaveValue('demo-patient-ana')
  await page.getByRole('navigation', { name: 'Atalhos clínicos' }).getByRole('link', { name: 'Documentos' }).click()
  await expect(page.getByLabel('Trocar contexto clínico')).toHaveValue('demo-patient-ana')
})

test('combina busca, status, ordenação e limpeza de filtros', async ({ page }) => {
  await page.goto('/pacientes')
  await page.getByLabel('Buscar pacientes').fill('Rafael')
  await expect(page.locator('.patient-row')).toHaveCount(1)
  await page.getByLabel('Ordenar pacientes').selectOption('alphabetical')
  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await expect(page.getByLabel('Buscar pacientes')).toHaveValue('')
  await expect(page.getByLabel('Ordenar pacientes')).toHaveValue('recent')
})

test('não cria overflow horizontal nas larguras da etapa', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 })
    for (const route of ['/pacientes', '/agenda', '/avaliacoes', '/planos', '/documentos', '/intelligence']) {
      await page.goto(route)
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
      expect(dimensions.document, `${route} em ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
      expect(dimensions.body, `${route} em ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
    }
  }
})

test('mantém alvos de toque e rótulos acessíveis no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pacientes')
  const controls = page.locator('button:visible, a:visible, input:visible, select:visible')
  const count = await controls.count()
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox()
    if (box && box.width > 0) expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(34)
  }
  await expect(page.getByLabel('Buscar pacientes')).toBeVisible()
  await expect(page.getByLabel('Filtrar por status')).toBeVisible()
  await expect(page.getByLabel('Ordenar pacientes')).toBeVisible()
})
