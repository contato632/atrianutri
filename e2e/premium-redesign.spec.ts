import { expect, test, type Page } from '@playwright/test'

const noDocumentOverflow = async (page: Page) => page.evaluate(() => ({
  viewport: window.innerWidth,
  document: document.documentElement.scrollWidth,
  body: document.body.scrollWidth,
}))

test('aplica a identidade premium e preserva o menu recolhível', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const sidebar = page.locator('.sidebar')
  const activeItem = sidebar.locator('.nav-item--active')
  await expect(sidebar).toBeVisible()
  await expect(activeItem).toHaveText(/Início/)

  const visual = await sidebar.evaluate((element) => {
    const sidebarStyle = getComputedStyle(element)
    const activeStyle = getComputedStyle(element.querySelector('.nav-item--active')!)
    return {
      background: sidebarStyle.backgroundImage,
      activeBorder: activeStyle.borderColor,
      activeShadow: activeStyle.boxShadow,
    }
  })
  expect(visual.background).toContain('gradient')
  expect(visual.activeBorder).not.toBe('rgba(0, 0, 0, 0)')
  expect(visual.activeShadow).not.toBe('none')

  const expandedWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width)
  await page.getByRole('button', { name: 'Recolher menu' }).click()
  await expect(page.getByRole('button', { name: 'Expandir menu' })).toHaveAttribute('aria-expanded', 'false')
  expect(expandedWidth).toBeGreaterThan(220)
  await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(90)
  expect((await noDocumentOverflow(page)).document).toBeLessThanOrEqual(1440)
})

test('mantém os sete dias alinhados na grade semanal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/agenda')
  const days = page.locator('.time-calendar__header > button')
  await expect(days).toHaveCount(7)
  const boxes = await days.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width }
  }))
  expect(new Set(boxes.map(({ y }) => Math.round(y))).size).toBe(1)
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].x).toBeGreaterThan(boxes[index - 1].x)
    expect(Math.abs(boxes[index].width - boxes[0].width)).toBeLessThan(1)
  }
  await expect(days.last()).toContainText(/dom\./i)
  expect((await noDocumentOverflow(page)).document).toBeLessThanOrEqual(1440)
})

test('mantém páginas principais sem overflow nas larguras de aceite', async ({ page }) => {
  const matrix = [
    { width: 360, routes: ['/', '/planos', '/documentos'] },
    { width: 390, routes: ['/pacientes', '/avaliacoes', '/gestao'] },
    { width: 768, routes: ['/agenda', '/intelligence'] },
    { width: 1024, routes: ['/pacientes', '/planos', '/documentos'] },
    { width: 1440, routes: ['/', '/agenda', '/avaliacoes', '/gestao', '/intelligence'] },
  ]

  for (const { width, routes } of matrix) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 })
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('.app-main')).toBeVisible()
      const dimensions = await noDocumentOverflow(page)
      expect(dimensions.document, `${route} em ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
      expect(dimensions.body, `${route} em ${width}px`).toBeLessThanOrEqual(dimensions.viewport)
    }
  }
})

test('oferece drawer móvel acessível e foco visível', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Abrir menu' })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('dialog', { name: 'Menu principal' })).toBeVisible()
  await page.getByRole('button', { name: 'Fechar menu' }).first().click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus')
  await expect(focused).toHaveAttribute('aria-label', 'Abrir menu')
  const focusStyle = await focused.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2)
  expect((await noDocumentOverflow(page)).document).toBeLessThanOrEqual(390)
})

test('respeita preferência por movimento reduzido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const duration = await page.locator('.sidebar').evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(.001)
})
