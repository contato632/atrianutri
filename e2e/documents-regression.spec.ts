import { expect, test, type Page } from '@playwright/test'

async function configureProfessionalIdentity(page: Page) {
  const settings = page.locator('.professional-settings')
  await settings.locator('summary').click()
  await settings.getByLabel('Nome profissional').fill('Dra. Marina Costa')
  await settings.getByLabel('CRN').fill('CRN-5 00000')
  await settings.getByLabel('Clínica ou consultório').fill('Clínica Fictícia de Validação')
  await settings.getByLabel('Complemento do cabeçalho').fill('Documento clínico fictício')
  await settings.getByLabel('Rodapé personalizado').fill('Validação local — sem dados reais')
  await settings.getByRole('button', { name: 'Salvar preferências da sessão' }).click()
  await expect(settings.getByRole('status')).toContainText('Preferências salvas')
}

test('abre Documentos diretamente sem falhas de módulos JavaScript', async ({ page }) => {
  const pageErrors: string[] = []
  const failedScripts: string[] = []
  const badScriptResponses: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'script') failedScripts.push(`${request.url()} — ${request.failure()?.errorText ?? 'falha'}`)
  })
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script' && response.status() >= 400) badScriptResponses.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/documentos')
  await expect(page.getByRole('heading', { name: 'Central de documentos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Página A4 final' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()

  expect(pageErrors).toEqual([])
  expect(failedScripts).toEqual([])
  expect(badScriptResponses).toEqual([])
})

test('abre Documentos pela sidebar e gera os quatro PDFs', async ({ page }) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Documentos' }).click()
  await expect(page).toHaveURL(/\/documentos$/)
  await expect(page.getByRole('heading', { name: 'Central de documentos' })).toBeVisible()

  await configureProfessionalIdentity(page)
  await page.getByLabel('Paciente do documento').selectOption('demo-patient-rafael')
  await expect(page.getByLabel('Paciente do documento')).toHaveValue('demo-patient-rafael')
  await page.getByLabel('Paciente do documento').selectOption('demo-patient-ana')

  const individualBranding = page.locator('.document-branding')
  await individualBranding.locator('summary').click()
  await individualBranding.getByLabel('Nome da clínica').fill('Identidade exclusiva deste PDF')

  const preview = page.getByTitle('Pré-visualização do PDF')
  const documents = [
    { button: /Avaliação Nutricional/, file: 'avaliacao-nutricional-ana-beatriz-lima.pdf' },
    { button: /Evolução Nutricional/, file: 'evolucao-nutricional-ana-beatriz-lima.pdf' },
    { button: /Plano Alimentar/, file: 'plano-alimentar-ana-beatriz-lima.pdf' },
    { button: /Resumo de Acompanhamento/, file: 'resumo-de-acompanhamento-ana-beatriz-lima.pdf' },
  ]

  for (const document of documents) {
    await page.getByRole('button', { name: document.button }).click()
    const previousUrl = await preview.count() ? await preview.getAttribute('src') : null
    await page.getByRole('button', { name: 'Atualizar prévia' }).click()
    await expect(preview).toHaveAttribute('src', /^blob:/)
    if (previousUrl) await expect.poll(() => preview.getAttribute('src')).not.toBe(previousUrl)

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Baixar PDF' }).click()
    expect((await download).suggestedFilename()).toBe(document.file)
  }

  expect(pageErrors).toEqual([])
})
