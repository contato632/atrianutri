import { expect, test } from '@playwright/test'

test('apresenta tendências, insights rastreáveis e linha do tempo filtrável', async ({ page }) => {
  await page.goto('/intelligence')
  await expect(page.getByRole('heading', { name: 'Intelligence Nutricional', level: 2 })).toBeVisible()
  await expect(page.getByRole('img', { name: /Peso ao longo do período/ })).toBeVisible()
  await expect(page.getByText('A última medida de cintura registrada é inferior à anterior')).toBeVisible()
  const insight = page.locator('.intelligence-insights article').filter({ hasText: 'Últimas medidas de cintura' })
  await insight.getByText('Regra, fontes e limitações').click()
  await expect(insight.getByText('Comparação aritmética das duas medidas profissionais mais recentes.')).toBeVisible()
  await page.getByLabel('Filtrar tipo').selectOption('plan-publication')
  await expect(page.locator('.intelligence-timeline li')).toHaveCount(1)
  await expect(page.getByText('Versão 2 disponibilizada ao paciente')).toBeVisible()
})

test('permite revisão, descarte e restauração sem modificar registros', async ({ page }) => {
  await page.goto('/intelligence')
  const first = page.locator('.intelligence-insights article').first()
  const title = await first.getByRole('heading').textContent()
  await first.getByRole('button', { name: 'Revisar' }).click()
  await expect(first).toContainText('Marcado para revisão')
  await first.getByRole('button', { name: 'Descartar' }).click()
  await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0)
  await page.getByRole('button', { name: /Restaurar 1 insight descartado/ }).click()
  await expect(page.getByRole('heading', { name: title ?? '' })).toBeVisible()
})

test('prepara resumo determinístico editável e mantém observação privada separada', async ({ page }) => {
  await page.goto('/intelligence')
  await page.getByLabel('Observação clínica privada da análise').fill('Leitura profissional fictícia, não compartilhada.')
  await page.getByRole('button', { name: 'Preparar resumo de acompanhamento' }).click()
  const summary = page.getByLabel('Resumo de acompanhamento editável')
  await expect(summary).toContainText('Plano prescrito e consumo relatado permanecem separados')
  await summary.fill('Resumo revisado manualmente pelo profissional fictício.')
  await expect(page.getByLabel('Observação clínica privada da análise')).toHaveValue('Leitura profissional fictícia, não compartilhada.')
  await expect(summary).toHaveValue('Resumo revisado manualmente pelo profissional fictício.')
})

test('isola paciente selecionado e permanece responsivo no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/intelligence')
  await page.getByLabel('Paciente no escopo clínico').selectOption('demo-patient-rafael')
  await expect(page.locator('.trend-card').first().getByText('85,1 kg', { exact: true })).toBeVisible()
  await expect(page.getByText('69,7 kg')).toHaveCount(0)
  await expect(page.getByText('Pão com ovo')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
