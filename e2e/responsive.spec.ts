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
