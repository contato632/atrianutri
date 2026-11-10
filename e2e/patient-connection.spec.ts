import { expect, test, type Page } from '@playwright/test'

async function enterPortalFromProfessional(page: Page) {
  await page.getByRole('link', { name: 'Abrir portal fictício' }).click()
  await page.getByRole('button', { name: 'Entrar na conta fictícia' }).click()
}

test('profissional cria, copia, cancela e substitui convite fictício', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/pacientes/demo-patient-rafael')
  const panel = page.locator('.connection-panel')
  await panel.getByRole('button', { name: 'Convidar paciente' }).click()
  await expect(panel.getByText('Pendente', { exact: true })).toBeVisible()
  await expect(panel.getByText('rafael.exemplo@demo.local')).toBeVisible()
  await panel.getByRole('button', { name: 'Copiar mensagem de convite' }).click()
  await expect(panel.getByRole('status')).toContainText('Nenhuma mensagem foi enviada')
  await panel.getByRole('button', { name: 'Cancelar convite' }).click()
  await expect(panel.getByText('Cancelado', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Criar novo convite' }).click()
  await expect(panel.getByText('Pendente', { exact: true })).toBeVisible()
})

test('publica versão escolhida sem expor o rascunho atual', async ({ page }) => {
  await page.goto('/planos')
  const publication = page.locator('.publication-panel')
  await publication.getByLabel('Versão aprovada pelo profissional').selectOption('1')
  await publication.getByRole('button', { name: 'Substituir versão publicada' }).click()
  await expect(publication.getByRole('status')).toContainText('Versão 1 disponibilizada')
  await enterPortalFromProfessional(page)
  await page.getByRole('navigation', { name: 'Navegação do paciente' }).getByRole('button', { name: 'Meu plano' }).click()
  await expect(page.getByText('Versão disponibilizada')).toBeVisible()
  await expect(page.locator('.portal-plan-meta')).toContainText('1')
  await expect(page.getByText('08:00')).toBeVisible()
})

test('suspende publicação e revoga portal ao encerrar vínculo', async ({ page }) => {
  await page.goto('/planos')
  await page.locator('.publication-panel').getByRole('button', { name: 'Suspender' }).click()
  await expect(page.locator('.publication-panel').getByRole('status')).toContainText('suspenso')
  await enterPortalFromProfessional(page)
  await page.getByRole('navigation', { name: 'Navegação do paciente' }).getByRole('button', { name: 'Meu plano' }).click()
  await expect(page.getByRole('heading', { name: 'Nenhum plano disponibilizado' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair do portal' }).click()
  await page.getByRole('link', { name: 'Sou profissional' }).click()
  await page.goto('/pacientes/demo-patient-ana')
  await page.locator('.connection-panel').getByRole('button', { name: 'Encerrar vínculo' }).click()
  await expect(page.locator('.connection-panel').getByText('Sem vínculo ativo')).toBeVisible()
  await page.getByRole('link', { name: 'Abrir portal fictício' }).click()
  await page.getByRole('button', { name: 'Entrar na conta fictícia' }).click()
  await expect(page.getByRole('heading', { name: 'Acesso indisponível' })).toBeVisible()
})

test('controles de vínculo permanecem utilizáveis no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pacientes/demo-patient-rafael')
  await page.locator('.connection-panel').getByRole('button', { name: 'Convidar paciente' }).click()
  await expect(page.locator('.connection-panel').getByText('Pendente', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
