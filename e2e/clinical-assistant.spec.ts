import { expect, test } from '@playwright/test'

test('gera análise simulada estruturada com referências e custo zero', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(request.url()) })
  await page.goto('/intelligence')
  await expect(page.getByText('Modo simulado')).toBeVisible()
  await expect(page.getByText('Integração real bloqueada')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar rascunho simulado' }).click()
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Informações documentadas' })).toBeVisible()
  await expect(page.locator('.clinical-source-links a').first()).toBeVisible()
  await expect(page.getByText('R$ 0,00 · simulado')).toBeVisible()
  expect(externalRequests).toEqual([])
})

test('oferece as quatro ferramentas e respeita a seleção de seções', async ({ page }) => {
  await page.goto('/intelligence')
  await page.getByLabel('Sugerir perguntas').check()
  await page.getByLabel('Tendências observadas').uncheck()
  await page.getByRole('button', { name: 'Gerar rascunho simulado' }).click()
  await expect(page.locator('.clinical-result__sections').getByText('Como a rotina atual tem influenciado os horários')).toBeVisible()
  await expect(page.locator('.clinical-result__sections').getByRole('heading', { name: 'Tendências observadas' })).toHaveCount(0)
  await expect(page.getByLabel('Analisar evolução')).toBeVisible()
  await expect(page.getByLabel('Preparar consulta')).toBeVisible()
  await expect(page.getByLabel('Rascunhar resumo')).toBeVisible()
})

test('mantém o rascunho editável sob revisão humana e permite descarte', async ({ page }) => {
  await page.goto('/intelligence')
  await page.getByLabel('Rascunhar resumo').check()
  await page.getByRole('button', { name: 'Gerar rascunho simulado' }).click()
  const draft = page.getByLabel('Rascunho clínico gerado e editável')
  await expect(draft).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copiar resultado revisado' })).toBeDisabled()
  await draft.fill('Texto revisado pelo profissional fictício.')
  await page.getByRole('button', { name: 'Marcar como revisado' }).click()
  await expect(page.getByText(/Revisado · operação/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copiar resultado revisado' })).toBeEnabled()
  await page.locator('.clinical-assistant').getByRole('button', { name: 'Descartar' }).click()
  await expect(draft).toHaveCount(0)
  await expect(page.getByText('Rascunho descartado sem alterar o prontuário.')).toBeVisible()
})

test('permanece responsivo no celular e cancela uma geração em andamento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/intelligence')
  await page.getByRole('button', { name: 'Gerar rascunho simulado' }).click()
  const cancel = page.getByRole('button', { name: 'Cancelar' })
  await expect(cancel).toBeAttached()
  await cancel.dispatchEvent('click')
  await expect(page.getByText('Geração cancelada. Nenhum rascunho foi aplicado.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
