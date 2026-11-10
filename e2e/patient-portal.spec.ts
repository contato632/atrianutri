import { expect, test, type Page } from '@playwright/test'

async function enterPortal(page: Page) {
  await page.goto('/portal')
  await expect(page.getByRole('heading', { name: 'Entrar no portal' })).toBeVisible()
  await page.getByRole('button', { name: 'Entrar na conta fictícia' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Ana.' })).toBeVisible()
}

test('paciente navega pelo plano disponibilizado sem controles de edição', async ({ page }) => {
  await enterPortal(page)
  await page.getByRole('navigation', { name: 'Navegação do paciente' }).getByRole('button', { name: 'Meu plano' }).click()
  await expect(page.getByRole('heading', { name: 'Meu plano alimentar' })).toBeVisible()
  await expect(page.getByText('Plano de organização semanal')).toBeVisible()
  await expect(page.getByText('Versão disponibilizada')).toBeVisible()
  await expect(page.getByText('Item definido pelo profissional')).toBeVisible()
  await expect(page.getByRole('button', { name: /Salvar|Adicionar|Substituir/ })).toHaveCount(0)
})

test('paciente registra alimentação como relato separado da prescrição', async ({ page }) => {
  await enterPortal(page)
  await page.getByRole('navigation', { name: 'Navegação do paciente' }).getByRole('button', { name: 'Diário' }).click()
  await page.getByRole('button', { name: 'Registrar refeição' }).click()
  await page.getByLabel('Alimento ou preparação').fill('Refeição fictícia registrada no portal')
  await page.getByLabel('Quantidade relatada opcional').fill('1 porção relatada')
  await page.getByLabel('Dificuldades percebidas opcional').fill('Horário diferente do habitual')
  await page.getByRole('button', { name: 'Salvar relato' }).click()
  await expect(page.getByRole('status')).toContainText('relato do paciente')
  await expect(page.getByText('Refeição fictícia registrada no portal')).toBeVisible()
  await expect(page.getByText('Relatado por você').first()).toBeVisible()
})

test('portal mostra apenas conteúdo compartilhado e nunca notas privadas ou financeiro', async ({ page }) => {
  await enterPortal(page)
  await expect(page.getByText('Planejar preparações para dois jantares da semana')).toHaveCount(0)
  await expect(page.getByText('Retomar estratégias individualizadas')).toHaveCount(0)
  await expect(page.getByText(/R\$|Cobrança|Pagamento/)).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Navegação do paciente' }).getByRole('button', { name: 'Metas' }).click()
  await page.getByRole('button', { name: 'Registrar acompanhamento' }).click()
  await page.getByLabel('O que você percebeu? opcional').fill('Relato fictício sem classificação automática')
  await page.getByRole('button', { name: 'Salvar acompanhamento' }).click()
  await expect(page.getByRole('status')).toContainText('relato do paciente')
})

test('portal mobile navega e apresenta evolução sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enterPortal(page)
  const navigation = page.getByRole('navigation', { name: 'Navegação mobile do paciente' })
  await navigation.getByRole('button', { name: 'Evolução' }).click()
  await expect(page.getByRole('heading', { name: 'Minha evolução' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Evolução descritiva do peso registrado' })).toBeVisible()
  await expect(page.getByText('Medidas registradas pelo profissional')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('recuperação informa a limitação da demonstração sem alegar envio', async ({ page }) => {
  await page.goto('/portal')
  await page.getByRole('button', { name: 'Esqueci meu acesso' }).click()
  await page.getByRole('button', { name: 'Solicitar instruções' }).click()
  await expect(page.getByRole('status')).toContainText('Nenhum e-mail foi enviado')
})
