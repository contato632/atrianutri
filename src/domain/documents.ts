import type { Assessment, Meal, NutritionWorkspace } from './models'

export type NutritionDocumentType = 'evaluation' | 'evolution' | 'meal-plan' | 'follow-up'

export type DocumentBranding = {
  clinicName: string
  professionalName: string
  crn: string
  headerText: string
  footerText: string
  primaryColor: string
}

export type NutritionDocumentOptions = {
  type: NutritionDocumentType
  patientId: string
  evaluationId?: string
  planId?: string
  planVersion?: number
  title: string
  introduction: string
  closingNotes: string
  sections: string[]
  branding: DocumentBranding
}

export type DocumentField = { label: string; value: string }
export type DocumentBlock =
  | { kind: 'fields'; id: string; title: string; fields: DocumentField[] }
  | { kind: 'paragraphs'; id: string; title: string; paragraphs: string[] }
  | { kind: 'table'; id: string; title: string; columns: string[]; rows: string[][] }
  | { kind: 'chart'; id: string; title: string; assessments: Assessment[] }

export type NutritionDocument = {
  type: NutritionDocumentType
  title: string
  patientName: string
  patientBirthDate: string
  generatedOn: string
  introduction: string
  closingNotes: string
  branding: DocumentBranding
  blocks: DocumentBlock[]
  fileName: string
}

export const documentDefinitions: Record<NutritionDocumentType, { label: string; description: string; title: string; sections: { id: string; label: string; restricted?: boolean }[] }> = {
  evaluation: {
    label: 'Avaliação Nutricional', description: 'Contexto, histórico, rotina, recordatório e antropometria registrados.', title: 'Relatório de Avaliação Nutricional',
    sections: [
      { id: 'patient', label: 'Identificação do paciente' }, { id: 'evaluation', label: 'Dados da avaliação' },
      { id: 'health', label: 'Histórico e contexto relatado' }, { id: 'routine', label: 'Rotina alimentar' },
      { id: 'recall', label: 'Recordatório de 24 horas' }, { id: 'anthropometry', label: 'Antropometria' },
      { id: 'professional-observations', label: 'Observações profissionais', restricted: true },
    ],
  },
  evolution: {
    label: 'Evolução Nutricional', description: 'Histórico antropométrico com gráfico e acompanhamento contextual.', title: 'Relatório de Evolução Nutricional',
    sections: [
      { id: 'patient', label: 'Identificação do paciente' }, { id: 'evolution-summary', label: 'Resumo da evolução' },
      { id: 'weight-chart', label: 'Gráfico de peso e cintura' }, { id: 'measurements', label: 'Histórico de medidas' },
      { id: 'goals', label: 'Metas acompanhadas' },
    ],
  },
  'meal-plan': {
    label: 'Plano Alimentar', description: 'Conteúdo manual da versão selecionada do plano alimentar.', title: 'Plano Alimentar',
    sections: [{ id: 'patient', label: 'Identificação do paciente' }, { id: 'plan-meta', label: 'Identificação da versão' }, { id: 'meals', label: 'Refeições e orientações' }],
  },
  'follow-up': {
    label: 'Resumo de Acompanhamento', description: 'Síntese dos registros existentes, sem criar conclusões clínicas.', title: 'Resumo de Acompanhamento Nutricional',
    sections: [
      { id: 'patient', label: 'Identificação do paciente' }, { id: 'follow-up-overview', label: 'Contexto do acompanhamento' },
      { id: 'recent-assessments', label: 'Avaliações recentes' }, { id: 'goals', label: 'Metas e progresso' },
      { id: 'appointments', label: 'Atendimentos nutricionais' },
    ],
  },
}

const date = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'Não informado'
const number = (value?: number, suffix = '') => value === undefined ? 'Não informado' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}`
const clean = (value?: string) => value?.trim() || 'Não informado'
const selected = (options: NutritionDocumentOptions, id: string) => options.sections.includes(id)
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function defaultDocumentOptions(type: NutritionDocumentType, patientId: string, professionalName = ''): NutritionDocumentOptions {
  const definition = documentDefinitions[type]
  return {
    type, patientId, title: definition.title, introduction: '', closingNotes: '',
    sections: definition.sections.filter((section) => !section.restricted).map((section) => section.id),
    branding: { clinicName: 'AtriaNutri', professionalName, crn: '', headerText: '', footerText: 'Documento gerado localmente pelo AtriaNutri.', primaryColor: '#176fa5' },
  }
}

export function resolvePlanMeals(workspace: NutritionWorkspace, planId: string | undefined, version: number | undefined): { title: string; version: number; meals: Meal[]; updatedAt: string } {
  const plan = workspace.mealPlans.find((item) => item.id === planId)
  if (!plan) throw new Error('Selecione um plano alimentar disponível para o paciente.')
  const targetVersion = version ?? plan.version
  if (targetVersion === plan.version) return { title: plan.title, version: plan.version, meals: plan.meals, updatedAt: plan.updatedAt }
  const revision = plan.revisions.find((item) => item.version === targetVersion && item.meals)
  if (!revision?.meals) throw new Error('O conteúdo desta versão não está disponível para impressão.')
  return { title: plan.title, version: revision.version, meals: revision.meals, updatedAt: revision.savedAt }
}

export function buildNutritionDocument(workspace: NutritionWorkspace, options: NutritionDocumentOptions): NutritionDocument {
  const patient = workspace.patients.find((item) => item.id === options.patientId)
  if (!patient) throw new Error('Selecione um paciente disponível.')
  if (!options.branding.professionalName.trim() || !options.branding.crn.trim()) throw new Error('Informe o nome do nutricionista e o CRN antes de gerar o PDF.')
  const profile = workspace.clinicalProfiles.find((item) => item.patientId === patient.id)
  const assessments = workspace.assessments.filter((item) => item.patientId === patient.id).sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))
  const evaluations = workspace.nutritionEvaluations.filter((item) => item.patientId === patient.id).sort((a, b) => b.evaluatedOn.localeCompare(a.evaluatedOn))
  const evaluation = evaluations.find((item) => item.id === options.evaluationId) ?? evaluations[0]
  const goals = workspace.habitGoals.filter((item) => item.patientId === patient.id)
  const checkIns = workspace.habitCheckIns.filter((item) => item.patientId === patient.id).sort((a, b) => b.recordedOn.localeCompare(a.recordedOn))
  const blocks: DocumentBlock[] = []

  if (selected(options, 'patient')) blocks.push({ kind: 'fields', id: 'patient', title: 'Identificação do paciente', fields: [
    { label: 'Nome', value: patient.fullName }, { label: 'Data de nascimento', value: date(patient.birthDate) },
  ] })

  if (options.type === 'evaluation') {
    if (!evaluation) throw new Error('Este paciente ainda não possui avaliação nutricional registrada.')
    if (selected(options, 'evaluation')) blocks.push({ kind: 'fields', id: 'evaluation', title: 'Dados da avaliação', fields: [
      { label: 'Data', value: date(evaluation.evaluatedOn) }, { label: 'Profissional registrado', value: clean(evaluation.authorLabel) },
      { label: 'Motivo da consulta', value: clean(evaluation.consultationReason) }, { label: 'Objetivo registrado', value: clean(profile?.goal) },
    ] })
    if (selected(options, 'health')) blocks.push({ kind: 'fields', id: 'health', title: 'Histórico e contexto relatado', fields: [
      { label: 'Histórico de saúde', value: clean(evaluation.healthHistory) }, { label: 'Alergias e intolerâncias relatadas', value: clean(evaluation.reportedAllergies) },
      { label: 'Medicamentos e suplementos informados', value: clean(evaluation.reportedMedications) }, { label: 'Acompanhamento nutricional anterior', value: clean(evaluation.previousNutritionCare) },
      { label: 'Restrições, preferências e contexto', value: clean(evaluation.foodRestrictionsAndPreferences) },
    ] })
    if (selected(options, 'routine')) blocks.push({ kind: 'fields', id: 'routine', title: 'Rotina alimentar relatada', fields: [
      { label: 'Horários habituais', value: clean(evaluation.usualMealSchedule) }, { label: 'Número de refeições', value: clean(evaluation.usualMealsCount) },
      { label: 'Ambiente das refeições', value: clean(evaluation.mealEnvironment) }, { label: 'Acesso a alimentos', value: clean(evaluation.foodAccess) },
      { label: 'Hidratação', value: clean(evaluation.hydration) }, { label: 'Dificuldades relatadas', value: clean(evaluation.reportedDifficulties) },
    ] })
    if (selected(options, 'recall')) {
      const recall = workspace.dietaryRecalls24h.find((item) => item.evaluationId === evaluation.id)
      blocks.push({ kind: 'table', id: 'recall', title: 'Recordatório de 24 horas', columns: ['Horário', 'Refeição', 'Alimentos relatados'], rows: recall?.meals.map((meal) => [meal.time || '—', meal.name, meal.foods.map((food) => `${food.name} — ${food.quantity}`).join('; ') || 'Não informado']) ?? [['—', 'Sem recordatório vinculado', '—']] })
    }
    if (selected(options, 'anthropometry')) blocks.push(measurementTable(assessments, 'anthropometry', 'Antropometria registrada'))
    if (selected(options, 'professional-observations')) blocks.push({ kind: 'paragraphs', id: 'professional-observations', title: 'Observações profissionais — conteúdo restrito', paragraphs: [clean(evaluation.professionalObservations)] })
  }

  if (options.type === 'evolution') {
    const first = assessments[0]; const latest = assessments.at(-1)
    if (selected(options, 'evolution-summary')) blocks.push({ kind: 'fields', id: 'evolution-summary', title: 'Resumo da evolução registrada', fields: [
      { label: 'Período', value: first && latest ? `${date(first.assessedAt)} a ${date(latest.assessedAt)}` : 'Sem avaliações' },
      { label: 'Avaliações', value: String(assessments.length) },
      { label: 'Peso inicial', value: number(first?.weightKg, ' kg') }, { label: 'Peso mais recente', value: number(latest?.weightKg, ' kg') },
      { label: 'Variação registrada', value: first && latest ? number(latest.weightKg - first.weightKg, ' kg') : 'Não informado' },
    ] })
    if (selected(options, 'weight-chart')) blocks.push({ kind: 'chart', id: 'weight-chart', title: 'Evolução de peso e cintura', assessments })
    if (selected(options, 'measurements')) blocks.push(measurementTable(assessments, 'measurements', 'Histórico de medidas'))
    if (selected(options, 'goals')) blocks.push(goalsTable(goals, checkIns))
  }

  if (options.type === 'meal-plan') {
    const plan = resolvePlanMeals(workspace, options.planId, options.planVersion)
    if (selected(options, 'plan-meta')) blocks.push({ kind: 'fields', id: 'plan-meta', title: 'Plano selecionado', fields: [
      { label: 'Plano', value: plan.title }, { label: 'Versão', value: String(plan.version) }, { label: 'Data da versão', value: date(plan.updatedAt) },
    ] })
    if (selected(options, 'meals')) for (const meal of plan.meals) blocks.push({ kind: 'table', id: `meal-${meal.id}`, title: `${meal.time || '—'} · ${meal.name}`, columns: ['Alimento ou preparação', 'Quantidade / porção'], rows: [
      ...(meal.foods.length ? meal.foods.map((food) => [food.name, food.quantity]) : [['Nenhum item registrado', '—']]),
      ...(meal.guidance ? [['Orientações', meal.guidance]] : []),
    ] })
  }

  if (options.type === 'follow-up') {
    if (selected(options, 'follow-up-overview')) blocks.push({ kind: 'fields', id: 'follow-up-overview', title: 'Contexto do acompanhamento', fields: [
      { label: 'Objetivo registrado', value: clean(profile?.goal) }, { label: 'Última avaliação nutricional', value: date(evaluation?.evaluatedOn) },
      { label: 'Motivo registrado', value: clean(evaluation?.consultationReason) }, { label: 'Plano alimentar atual', value: workspace.mealPlans.find((item) => item.patientId === patient.id)?.title ?? 'Não informado' },
    ] })
    if (selected(options, 'recent-assessments')) blocks.push(measurementTable(assessments.slice(-5), 'recent-assessments', 'Avaliações recentes'))
    if (selected(options, 'goals')) blocks.push(goalsTable(goals, checkIns))
    if (selected(options, 'appointments')) {
      const appointments = workspace.appointments.filter((item) => item.patientId === patient.id && ['nutrition-consultation', 'follow-up'].includes(item.category)).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      blocks.push({ kind: 'table', id: 'appointments', title: 'Atendimentos nutricionais', columns: ['Data', 'Tipo', 'Estado'], rows: appointments.length ? appointments.slice(0, 10).map((item) => [date(item.startsAt), item.category === 'follow-up' ? 'Retorno' : 'Consulta nutricional', item.status]) : [['—', 'Nenhum atendimento registrado', '—']] })
    }
  }

  const generatedOn = new Date().toISOString()
  return { type: options.type, title: options.title.trim() || documentDefinitions[options.type].title, patientName: patient.fullName, patientBirthDate: patient.birthDate, generatedOn, introduction: options.introduction.trim(), closingNotes: options.closingNotes.trim(), branding: options.branding, blocks, fileName: `${slug(documentDefinitions[options.type].label)}-${slug(patient.fullName)}.pdf` }
}

function measurementTable(assessments: Assessment[], id: string, title: string): DocumentBlock {
  return { kind: 'table', id, title, columns: ['Data', 'Peso', 'IMC', 'Cintura', 'Quadril'], rows: assessments.length ? [...assessments].reverse().map((item) => [date(item.assessedAt), number(item.weightKg, ' kg'), number(item.bmi), number(item.waistCm, ' cm'), number(item.hipCm, ' cm')]) : [['—', 'Sem avaliações', '—', '—', '—']] }
}

function goalsTable(goals: NutritionWorkspace['habitGoals'], checkIns: NutritionWorkspace['habitCheckIns']): DocumentBlock {
  return { kind: 'table', id: 'goals', title: 'Metas e acompanhamento', columns: ['Meta', 'Estado', 'Último registro'], rows: goals.length ? goals.map((goal) => {
    const latest = checkIns.find((item) => item.goalId === goal.id)
    return [goal.title, goal.status, latest ? `${date(latest.recordedOn)} — ${clean(latest.notes || latest.nextStep)}` : 'Sem acompanhamento registrado']
  }) : [['Nenhuma meta registrada', '—', '—']] }
}
