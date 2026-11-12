import { expect,test } from '@playwright/test'

async function openPatient(page: import('@playwright/test').Page) {
  await page.goto('/pacientes')
  await page.locator('.patient-row__main').filter({hasText:'Ana Beatriz Lima'}).click()
  await expect(page.getByRole('heading',{name:'Anamnese nutricional'})).toBeVisible()
}

test('salva rascunho progressivo e conclui versão histórica',async({page})=>{
  await openPatient(page)
  await page.getByRole('button',{name:'Iniciar anamnese'}).click()
  const firstField=page.locator('.smart-field').first()
  await firstField.getByText('Motivo do atendimento',{exact:true}).click()
  await firstField.getByLabel('Situação da informação').selectOption('informed')
  await firstField.getByLabel('Motivo do atendimento').fill('Organizar a rotina alimentar durante o trabalho.')
  await firstField.getByLabel('Origem').selectOption('patient')
  await page.getByRole('button',{name:'Salvar rascunho'}).click()
  await expect(page.getByRole('button',{name:'Continuar rascunho'})).toBeVisible()
  await page.getByRole('button',{name:'Continuar rascunho'}).click()
  for(let step=0;step<6;step+=1) await page.getByRole('button',{name:'Próxima'}).click()
  await expect(page.getByRole('heading',{name:'Revise antes de concluir'})).toBeVisible()
  await page.getByLabel(/Observações clínicas privadas/).fill('Nota profissional fictícia e privada.')
  await page.getByRole('button',{name:'Concluir versão'}).click()
  await expect(page.getByText('Versão 1').first()).toBeVisible()
  await page.getByText('Ver histórico de anamneses').click()
  await expect(page.getByText('Anamnese inicial',{exact:true})).toBeVisible()
})

test('mantém wizard utilizável no celular sem overflow horizontal',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await openPatient(page)
  await page.getByRole('button',{name:'Iniciar anamnese'}).click()
  await expect(page.locator('.anamnesis-progress')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await expect(page.getByRole('button',{name:'Salvar rascunho'})).toBeVisible()
})
