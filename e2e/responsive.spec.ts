import { expect, test } from '@playwright/test'

test('mantém navegação e conteúdo íntegros no desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bom dia, Marina.' })).toBeVisible()
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.mobile-tabs')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('usa navegação móvel sem estouro horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Navegação mobile' }).getByRole('link', { name: 'Pacientes' }).click()
  await expect(page.getByRole('heading', { name: 'Seus pacientes' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('registra diário e alterna hábitos no prontuário desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/pacientes/demo-patient-ana')
  await expect(page.getByRole('heading', { name: 'Diário alimentar' })).toBeVisible()
  await page.getByLabel('Tipo de refeição').selectOption('lunch')
  await expect(page.getByText('Arroz, feijão e preparação caseira')).toBeVisible()
  await expect(page.getByText('Pão com ovo · Café com leite')).toBeHidden()
  await page.getByLabel('Tipo de refeição').selectOption('all')
  await page.getByRole('button', { name: 'Nova entrada' }).click()
  await expect(page.getByRole('heading', { name: 'Nova entrada no diário' })).toBeVisible()
  await page.getByLabel('Alimento ou preparação').fill('Refeição fictícia do teste responsivo')
  await page.getByRole('button', { name: 'Registrar refeição' }).click()
  await expect(page.getByText('Refeição fictícia do teste responsivo')).toBeVisible()
  await page.getByRole('tab', { name: 'Hábitos e metas' }).click()
  await expect(page.getByText('Organizar o horário do almoço em dias de reunião')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('mantém diário e hábitos utilizáveis no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pacientes/demo-patient-ana')
  await expect(page.getByRole('heading', { name: 'Diário alimentar' })).toBeVisible()
  await page.getByRole('tab', { name: 'Hábitos e metas' }).click()
  await expect(page.getByRole('button', { name: 'Nova meta' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
