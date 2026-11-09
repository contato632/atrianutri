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

test('cria avaliação estruturada e navega pelas fontes clínicas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/pacientes/demo-patient-rafael')
  await expect(page.getByRole('heading', { name: 'Avaliação nutricional completa' })).toBeVisible()
  await page.getByRole('button', { name: 'Iniciar avaliação' }).click()
  await page.getByLabel('Motivo da consulta opcional').fill('Motivo exclusivamente fictício para teste')
  await page.getByRole('button', { name: 'Salvar avaliação' }).click()
  await expect(page.getByText('Motivo exclusivamente fictício para teste')).toBeVisible()
  await page.getByRole('tab', { name: 'Evolução' }).click()
  await expect(page.getByText('Comparação descritiva, sem classificar melhora ou piora.')).toBeVisible()
  await page.locator('.evaluation-module').getByLabel('Período').selectOption('90')
  await expect(page.locator('.evolution-timeline')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('exibe recordatório separado do diário em viewport móvel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pacientes/demo-patient-ana')
  await page.getByRole('tab', { name: 'Recordatório 24h' }).click()
  await expect(page.getByText('Registro retrospectivo, separado do Diário Alimentar contínuo.')).toBeVisible()
  await expect(page.getByText('Pão com ovo — 1 unidade relatada · Café com leite — 1 xícara relatada')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('cria agenda pelo horário livre e sinaliza conflito no modo demonstração',async({page})=>{
  await page.setViewportSize({width:1280,height:900});await page.goto('/agenda');await expect(page.getByRole('heading',{name:'Agenda profissional'})).toBeVisible();await page.getByRole('button',{name:/Criar agendamento em .* às 7:00/}).first().click();await page.getByLabel('Paciente').selectOption('demo-patient-ana');await page.getByRole('button',{name:'Salvar'}).click();await expect(page.getByText('Ana Beatriz Lima').first()).toBeVisible();await page.getByRole('button',{name:'Novo agendamento'}).click();await page.getByLabel('Paciente').selectOption('demo-patient-rafael');await page.locator('input[type="time"]').fill('07:00');await expect(page.getByRole('alert')).toContainText('conflita');await expect(page.getByRole('button',{name:'Salvar'})).toBeDisabled();await page.locator('.appointment-form>footer').getByRole('button',{name:'Fechar'}).click();await page.getByRole('button',{name:'Mês'}).click();await expect(page.locator('.calendar-grid--month')).toBeVisible()
})

test('mantém agenda diária utilizável no celular',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/agenda');await page.getByRole('button',{name:'Dia'}).click();await expect(page.locator('.calendar-grid--day')).toBeVisible();await page.getByRole('button',{name:'Novo agendamento'}).click();await expect(page.getByText('Adicionar à agenda')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)})

test('cadastra serviço administrativo na Gestão',async({page})=>{await page.goto('/gestao');await page.getByRole('button',{name:'Novo serviço'}).click();await page.getByLabel('Nome do serviço').fill('Serviço fictício E2E');await page.getByRole('button',{name:'Salvar serviço'}).click();await expect(page.getByText('Serviço fictício E2E')).toBeVisible()})
