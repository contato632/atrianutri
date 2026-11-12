import { expect, test, type Page } from '@playwright/test'

async function configureDocumentIdentity(page: Page) {
  const settings = page.locator('.professional-settings')
  await settings.locator('summary').click()
  await settings.getByLabel('Nome profissional').fill('Dra. Marina Costa')
  await settings.getByLabel('CRN').fill('CRN-5 00000')
  await settings.getByRole('button', { name: 'Salvar preferências da sessão' }).click()
}

test('integra contexto, anamnese, plano, Intelligence e documento sem cruzar pacientes', async ({ page }) => {
  await page.goto('/pacientes')
  await page.locator('.patient-row__main').filter({ hasText: 'Ana Beatriz Lima' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Beatriz Lima' })).toBeVisible()

  await page.getByRole('button', { name: 'Iniciar anamnese' }).click()
  const firstField = page.locator('.smart-field').first()
  await firstField.getByText('Motivo do atendimento', { exact: true }).click()
  await firstField.getByLabel('Situação da informação').selectOption('informed')
  await firstField.getByLabel('Motivo do atendimento').fill('Rascunho fictício exclusivo de Ana.')
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()
  await expect(page.getByRole('button', { name: 'Continuar rascunho' })).toBeVisible()

  await page.getByLabel('Trocar contexto clínico').selectOption('demo-patient-rafael')
  await expect(page).toHaveURL(/\/pacientes\/demo-patient-rafael$/)
  await expect(page.getByRole('heading', { name: 'Rafael Monteiro' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar rascunho' })).toHaveCount(0)
  await page.getByLabel('Trocar contexto clínico').selectOption('demo-patient-ana')
  await expect(page).toHaveURL(/\/pacientes\/demo-patient-ana$/)
  await expect(page.getByRole('button', { name: 'Continuar rascunho' })).toBeVisible()

  const journey = page.getByRole('navigation', { name: 'Atalhos clínicos' })
  await journey.getByRole('link', { name: 'Avaliações' }).click()
  await expect(page.getByLabel('Selecionar paciente')).toHaveValue('demo-patient-ana')
  await journey.getByRole('link', { name: 'Plano' }).click()
  await expect(page.locator('.plan-toolbar select').first()).toHaveValue('demo-patient-ana')

  const meal = page.locator('.meal-card').first()
  await meal.getByRole('button', { name: 'Pesquisar no catálogo' }).click()
  await meal.getByRole('tab', { name: /Científico/ }).click()
  await expect(meal.getByText('Catálogo científico ainda não incorporado')).toBeVisible()
  await meal.getByRole('tab', { name: /Demonstração/ }).click()
  await meal.getByLabel('Buscar alimento no catálogo').fill('banana')
  await meal.getByRole('button', { name: /Banana demonstrativa/ }).click()
  await expect(meal.getByLabel('Composição de Banana demonstrativa')).toContainText('Catálogo demonstrativo AtriaNutri')
  await meal.getByRole('button', { name: 'Confirmar inclusão' }).click()
  await expect(page.locator('.nutrition-panel')).toContainText('Composição calculada')

  await journey.getByRole('link', { name: 'Evolução' }).click()
  await expect(page.getByLabel('Paciente no escopo clínico')).toHaveValue('demo-patient-ana')
  await expect(page.getByRole('heading', { name: 'Intelligence Nutricional', level: 2 })).toBeVisible()
  await journey.getByRole('link', { name: 'Documentos' }).click()
  await expect(page.getByLabel('Paciente do documento')).toHaveValue('demo-patient-ana')
  await configureDocumentIdentity(page)
  await page.getByRole('button', { name: /Plano Alimentar/ }).click()
  await page.getByRole('button', { name: 'Atualizar prévia' }).click()
  await expect(page.getByTitle('Pré-visualização do PDF')).toHaveAttribute('src', /^blob:/)
})
