import { expect, test, type Page } from '@playwright/test'

async function configureDocumentIdentity(page: Page) {
  const settings = page.locator('.professional-settings')
  await settings.locator('summary').click()
  await settings.getByLabel('Nome profissional').fill('Dra. Marina Costa')
  await settings.getByLabel('CRN').fill('CRN-5 00000')
  await settings.getByLabel('Telefone profissional').fill('(71) 3000-0000')
  await settings.getByLabel('E-mail profissional').fill('marina@example.test')
  await settings.getByRole('button', { name: 'Salvar preferências da sessão' }).click()
  await expect(settings.getByRole('status')).toContainText('Preferências salvas')
}

test('mantém navegação e conteúdo íntegros no desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bom dia, Marina.' })).toBeVisible()
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.mobile-tabs')).toBeHidden()
  await expect(page.locator('.topbar__title span')).not.toHaveText('Domingo, 8 de novembro')
  await page.getByRole('link', { name: 'Ver agenda' }).click()
  await expect(page).toHaveURL(/\/agenda$/)
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
  await page.setViewportSize({width:1280,height:900});await page.goto('/agenda');await expect(page.getByRole('heading',{name:'Agenda profissional'})).toBeVisible();await page.getByRole('button',{name:/Criar agendamento em .* às 7:00/}).first().click();await page.getByLabel('Paciente').selectOption('demo-patient-ana');await page.getByRole('button',{name:'Salvar'}).click();await expect(page.getByText('Ana Beatriz Lima').first()).toBeVisible();await page.getByRole('button',{name:'Novo agendamento'}).click();await page.getByLabel('Paciente').selectOption('demo-patient-rafael');await page.locator('input[type="time"]').fill('07:00');await expect(page.getByRole('alert')).toContainText('conflita');await expect(page.getByRole('button',{name:'Salvar'})).toBeDisabled();page.once('dialog',(dialog)=>dialog.accept());await page.locator('.appointment-form>footer').getByRole('button',{name:'Fechar'}).click();await page.getByRole('button',{name:'Mês'}).click();await expect(page.locator('.calendar-grid--month')).toBeVisible()
})

test('mantém agenda diária utilizável no celular',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/agenda');await page.getByRole('button',{name:'Dia'}).click();await expect(page.locator('.calendar-grid--day')).toBeVisible();await page.getByRole('button',{name:'Novo agendamento'}).click();await expect(page.getByText('Adicionar à agenda')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)})

test('cadastra serviço administrativo na Gestão',async({page})=>{await page.goto('/gestao');await page.getByRole('button',{name:'Novo serviço'}).click();await page.getByLabel('Nome do serviço').fill('Serviço fictício E2E');await page.getByRole('button',{name:'Salvar serviço'}).click();await expect(page.getByText('Serviço fictício E2E')).toBeVisible()})

test('cria cobrança avulsa e registra recebimento integral',async({page})=>{await page.goto('/financeiro');await expect(page.getByRole('heading',{name:'Financeiro do consultório'})).toBeVisible();await page.getByRole('button',{name:'Nova cobrança'}).click();await page.locator('select[name="patientId"]').selectOption('demo-patient-marcos');await page.getByLabel('Descrição').fill('Consulta financeira fictícia');await page.getByLabel('Valor').fill('120,00');await page.getByRole('button',{name:'Criar cobrança'}).click();const row=page.locator('.finance-row').filter({hasText:'Marcos Vinícius Alves'});await expect(row).toContainText('R$ 120,00');await row.getByRole('button',{name:'Receber'}).click();await page.getByRole('button',{name:'Registrar recebimento'}).click();await expect(row).toContainText('Paga')})

test('mantém painel financeiro responsivo e registra despesa prevista',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/financeiro');await expect(page.getByText('Receita recebida')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.getByRole('button',{name:'Nova despesa'}).click();await page.getByLabel('Descrição').fill('Despesa fictícia E2E');await page.locator('select[name="categoryId"]').selectOption('expense-cat-other');await page.getByLabel('Valor').fill('75,00');await page.getByRole('button',{name:'Salvar despesa'}).click();await page.getByRole('button',{name:'Despesas'}).click();await expect(page.getByText('Despesa fictícia E2E')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)})

test('gera prévia e download do plano na versão selecionada',async({page})=>{await page.setViewportSize({width:1366,height:900});await page.goto('/documentos');await expect(page.getByRole('heading',{name:'Central de documentos'})).toBeVisible();await configureDocumentIdentity(page);await expect(page.getByRole('button',{name:/Avaliação Nutricional/})).toBeVisible();await expect(page.getByRole('button',{name:/Evolução Nutricional/})).toBeVisible();await expect(page.getByRole('button',{name:/Resumo de Acompanhamento/})).toBeVisible();await page.getByRole('button',{name:/Plano Alimentar/}).click();await page.getByLabel('Versão do plano').selectOption('1');await page.getByRole('button',{name:'Atualizar prévia'}).click();await expect(page.getByTitle('Pré-visualização do PDF')).toHaveAttribute('src',/^blob:/);const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar PDF'}).click();expect((await download).suggestedFilename()).toContain('plano-alimentar-ana-beatriz-lima.pdf')})

test('mantém editor de documentos e prévia A4 utilizáveis no celular',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/documentos');await configureDocumentIdentity(page);await expect(page.getByLabel('Pré-visualização da identidade em página A4')).toBeVisible();await page.getByRole('button',{name:/Evolução Nutricional/}).click();await page.getByRole('button',{name:'Atualizar prévia'}).click();await expect(page.getByTitle('Pré-visualização do PDF')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)})

test('mantém personalização individual separada das preferências gerais',async({page})=>{await page.goto('/documentos');await configureDocumentIdentity(page);const settings=page.locator('.professional-settings');await settings.locator('summary').click();const individual=page.locator('.document-branding');await individual.locator('summary').click();await individual.getByLabel('Nome da clínica').fill('Clínica somente deste PDF');await settings.locator('summary').click();await expect(settings.getByLabel('Clínica ou consultório')).toHaveValue('AtriaNutri')})

test('monta plano com catálogo, cálculo, substituição confirmada e nova versão',async({page})=>{await page.setViewportSize({width:1440,height:1000});await page.goto('/planos');await expect(page.getByRole('heading',{name:'Planejamento alimentar profissional'})).toBeVisible();await page.getByRole('button',{name:'Pesquisar no catálogo'}).first().click();await page.getByLabel('Buscar alimento no catálogo').fill('banana');await page.getByRole('button',{name:/Banana demonstrativa/}).click();await page.getByRole('button',{name:'Confirmar inclusão'}).click();const structured=page.locator('.structured-food-row').first();await expect(structured).toContainText('76,5 kcal');await structured.getByRole('button',{name:'Comparar substituições'}).click();await expect(structured).toContainText('Maçã demonstrativa');await structured.getByRole('button',{name:'Confirmar substituição'}).click();await expect(structured).toContainText('Substituiu Banana demonstrativa');await page.locator('.nutrition-targets summary').click();await page.locator('.nutrition-targets input').first().fill('2000');await page.getByRole('button',{name:'Salvar nova versão'}).click();await expect(page.getByText('Nova versão salva')).toBeVisible();await expect(page.locator('.revision-list')).toContainText('Versão 3')})

test('mantém planejamento alimentar utilizável no celular sem rolagem horizontal',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/planos');await page.getByRole('button',{name:'Pesquisar no catálogo'}).first().click();await page.getByLabel('Buscar alimento no catálogo').fill('feijão');await page.getByRole('button',{name:/Feijão demonstrativo/}).click();await page.getByRole('button',{name:'Confirmar inclusão'}).click();await expect(page.locator('.nutrition-panel')).toContainText('Composição calculada');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)})

test('cadastra alimento personalizado com composição explícita',async({page})=>{await page.goto('/planos');await page.locator('.plan-toolbar label').filter({hasText:'Paciente'}).getByRole('combobox').selectOption('demo-patient-rafael');await page.getByRole('button',{name:'Adicionar primeira refeição'}).click();await page.getByRole('button',{name:'Alimento personalizado'}).click();const form=page.locator('.custom-food-form');await form.getByLabel('Nome do alimento').fill('Preparação fictícia E2E');await form.locator('input[name="amount"]').fill('50');await form.getByLabel('kcal').fill('200');await form.getByLabel('Proteínas (g)').fill('10');await form.getByRole('button',{name:'Adicionar alimento'}).click();await expect(page.locator('.structured-food-row')).toContainText('100 kcal');await page.getByRole('button',{name:'Salvar primeira versão'}).click();await expect(page.getByText('Nova versão salva')).toBeVisible()})

test('separa catálogo científico vazio da demonstração e aplica filtros',async({page})=>{await page.goto('/planos');await page.getByRole('button',{name:'Pesquisar no catálogo'}).first().click();await page.getByRole('tab',{name:/Científico/}).click();await expect(page.getByText('Catálogo científico ainda não incorporado')).toBeVisible();await expect(page.getByRole('button',{name:/Banana demonstrativa/})).toBeHidden();await page.getByRole('tab',{name:/Demonstração/}).click();await page.getByLabel('Filtrar categoria').selectOption('Frutas');await expect(page.getByRole('button',{name:/Banana demonstrativa/})).toBeVisible();await expect(page.getByRole('button',{name:/Arroz demonstrativo/})).toBeHidden()})
