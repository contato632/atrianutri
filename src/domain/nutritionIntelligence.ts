import type { Assessment, NutritionWorkspace } from './models'
import { publishedPlanVersion } from './patientConnection'
import { anamnesisLongitudinalChanges, anamnesisProgress } from './anamnesis'

export type IntelligenceOrigin = 'professional' | 'patient' | 'system'
export type IntelligenceEventType = 'assessment' | 'evaluation' | 'anamnesis' | 'diary' | 'barrier' | 'goal' | 'habit' | 'plan-version' | 'plan-publication'
export type DateRange = { start: string; end: string }
export type IntelligenceEvent = { id: string; date: string; type: IntelligenceEventType; origin: IntelligenceOrigin; title: string; summary: string; href: string; sourceRefs: string[] }
export type IntelligenceInsight = { id: string; title: string; message: string; rule: string; interval: DateRange; limitations: string; sourceRefs: string[]; href: string }

const inRange = (value: string, range: DateRange) => value.slice(0, 10) >= range.start && value.slice(0, 10) <= range.end
const daysBetween = (first: string, second: string) => Math.round((new Date(`${second.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${first.slice(0, 10)}T12:00:00Z`).getTime()) / 86400000)
const mealTypeLabel: Record<string, string> = { breakfast: 'Café da manhã', 'morning-snack': 'Lanche da manhã', lunch: 'Almoço', 'afternoon-snack': 'Lanche da tarde', dinner: 'Jantar', 'evening-snack': 'Ceia', other: 'Outro' }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim()

export function periodRange(period: '30' | '90' | '180' | '365', end: string): DateRange {
  const endDate = new Date(`${end}T12:00:00Z`); const startDate = new Date(endDate); startDate.setUTCDate(startDate.getUTCDate() - Number(period) + 1)
  return { start: startDate.toISOString().slice(0, 10), end }
}

export function buildNutritionTimeline(workspace: NutritionWorkspace, patientId: string, range: DateRange): IntelligenceEvent[] {
  if (!workspace.patients.some((item) => item.id === patientId)) throw new Error('Paciente não encontrado no escopo clínico atual.')
  const href = `/pacientes/${patientId}`; const events: IntelligenceEvent[] = []
  for (const item of workspace.assessments.filter((row) => row.patientId === patientId && inRange(row.assessedAt, range))) events.push({ id: `assessment:${item.id}`, date: item.assessedAt, type: 'assessment', origin: 'professional', title: 'Medidas antropométricas registradas', summary: `Peso ${item.weightKg.toLocaleString('pt-BR')} kg${item.waistCm === undefined ? '' : ` · cintura ${item.waistCm.toLocaleString('pt-BR')} cm`}.`, href, sourceRefs: [item.id] })
  for (const item of workspace.nutritionEvaluations.filter((row) => row.patientId === patientId && inRange(row.evaluatedOn, range))) events.push({ id: `evaluation:${item.id}`, date: item.evaluatedOn, type: 'evaluation', origin: 'professional', title: 'Avaliação nutricional registrada', summary: item.consultationReason || 'Avaliação estruturada sem motivo resumido.', href, sourceRefs: [item.id] })
  for (const item of (workspace.anamneses ?? []).filter((row) => row.patientId === patientId && row.status === 'completed' && inRange(row.recordedOn, range))) events.push({ id:`anamnesis:${item.id}`,date:item.recordedOn,type:'anamnesis',origin:'professional',title:`Versão ${item.version} da anamnese registrada`,summary:`${anamnesisProgress(item.answers).documented} informações documentadas; fontes mantidas por resposta.`,href,sourceRefs:[item.id] })
  for (const item of workspace.foodDiaryEntries.filter((row) => row.patientId === patientId && inRange(row.entryDate, range))) {
    events.push({ id: `diary:${item.id}`, date: `${item.entryDate}T${item.mealTime}`, type: 'diary', origin: item.source, title: item.source === 'patient' ? 'Registro alimentar compartilhado pelo paciente' : 'Registro alimentar profissional', summary: `${mealTypeLabel[item.mealType]} · ${item.foods.length} ${item.foods.length === 1 ? 'item relatado' : 'itens relatados'}.`, href, sourceRefs: [item.id] })
    if (item.routineChanges.trim()) events.push({ id: `barrier:diary:${item.id}`, date: `${item.entryDate}T${item.mealTime}`, type: 'barrier', origin: item.source, title: 'Dificuldade ou mudança de rotina relatada', summary: item.routineChanges, href, sourceRefs: [item.id] })
  }
  for (const item of (workspace.habitGoals ?? []).filter((row) => row.patientId === patientId)) {
    if (inRange(item.createdAt, range)) events.push({ id: `goal:${item.id}`, date: item.createdAt, type: 'goal', origin: 'professional', title: 'Meta registrada', summary: item.title, href, sourceRefs: [item.id] })
    if (item.updatedAt !== item.createdAt && inRange(item.updatedAt, range)) events.push({ id: `goal-update:${item.id}`, date: item.updatedAt, type: 'goal', origin: 'professional', title: 'Meta atualizada', summary: `${item.title} · estado ${item.status}.`, href, sourceRefs: [item.id] })
  }
  for (const item of (workspace.habitCheckIns ?? []).filter((row) => row.patientId === patientId && inRange(row.recordedOn, range))) {
    events.push({ id: `habit:${item.id}`, date: item.recordedOn, type: 'habit', origin: item.source, title: 'Acompanhamento de meta registrado', summary: item.notes || 'Acompanhamento sem observação textual.', href, sourceRefs: [item.id] })
    if (item.difficulties.trim()) events.push({ id: `barrier:habit:${item.id}`, date: item.recordedOn, type: 'barrier', origin: item.source, title: 'Barreira relatada no acompanhamento', summary: item.difficulties, href, sourceRefs: [item.id] })
  }
  for (const plan of workspace.mealPlans.filter((row) => row.patientId === patientId)) for (const revision of plan.revisions.filter((row) => inRange(row.savedAt, range))) events.push({ id: `plan-version:${plan.id}:${revision.version}`, date: revision.savedAt, type: 'plan-version', origin: 'professional', title: `Versão ${revision.version} do plano registrada`, summary: revision.summary || 'Versão salva sem resumo adicional.', href: '/planos', sourceRefs: [plan.id, String(revision.version)] })
  for (const item of (workspace.mealPlanPublications ?? []).filter((row) => row.patientId === patientId && inRange(row.publishedAt, range))) events.push({ id: `publication:${item.id}`, date: item.publishedAt, type: 'plan-publication', origin: 'professional', title: item.status === 'active' ? `Versão ${item.version} disponibilizada ao paciente` : `Publicação da versão ${item.version} suspensa`, summary: 'Evento de compartilhamento do plano; não indica consumo ou resultado clínico.', href: '/planos', sourceRefs: [item.id, item.mealPlanId] })
  return events.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export type MeasureTrend = { key: 'weightKg' | 'waistCm' | 'hipCm' | 'armCm' | 'bodyFatPercentage'; label: string; unit: string; points: Array<{ date: string; value: number; sourceRef: string }>; absoluteChange?: number; percentageChange?: number; intervalDays?: number }

export function anthropometricTrends(assessments: Assessment[], range: DateRange): MeasureTrend[] {
  const rows = assessments.filter((item) => inRange(item.assessedAt, range)).sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))
  const definitions = [
    ['weightKg', 'Peso', 'kg'], ['waistCm', 'Circunferência da cintura', 'cm'], ['hipCm', 'Circunferência do quadril', 'cm'], ['armCm', 'Circunferência do braço', 'cm'], ['bodyFatPercentage', 'Percentual informado', '%'],
  ] as const
  return definitions.map(([key, label, unit]) => {
    const points = rows.flatMap((item) => item[key] === undefined ? [] : [{ date: item.assessedAt, value: item[key] as number, sourceRef: item.id }])
    if (points.length < 2) return { key, label, unit, points }
    const first = points[0]; const last = points.at(-1)!; const absoluteChange = Number((last.value - first.value).toFixed(2))
    return { key, label, unit, points, absoluteChange, percentageChange: Number((absoluteChange / first.value * 100).toFixed(2)), intervalDays: daysBetween(first.date, last.date) }
  }).filter((item) => item.points.length)
}

export function habitIndicators(workspace: NutritionWorkspace, patientId: string, range: DateRange) {
  const goals = workspace.habitGoals.filter((item) => item.patientId === patientId && inRange(item.createdAt, range))
  const checkIns = workspace.habitCheckIns.filter((item) => item.patientId === patientId && inRange(item.recordedOn, range)).sort((a, b) => a.recordedOn.localeCompare(b.recordedOn))
  const gaps = checkIns.slice(1).map((item, index) => daysBetween(checkIns[index].recordedOn, item.recordedOn))
  return { goals: goals.length, checkIns: checkIns.length, patientReports: checkIns.filter((item) => item.source === 'patient').length, barriers: checkIns.filter((item) => item.difficulties.trim()).length, largestGapDays: gaps.length ? Math.max(...gaps) : undefined, sourceRefs: [...goals.map((item) => item.id), ...checkIns.map((item) => item.id)] }
}

export function diaryIndicators(workspace: NutritionWorkspace, patientId: string, range: DateRange, organizationId = 'demo-organization') {
  const entries = workspace.foodDiaryEntries.filter((item) => item.patientId === patientId && inRange(item.entryDate, range))
  const published = publishedPlanVersion(workspace.mealPlans, workspace.mealPlanPublications ?? [], organizationId, patientId)
  const prescribed = new Set((published?.meals ?? []).map((item) => normalize(item.name)))
  const reported = new Set(entries.filter((item) => item.source === 'patient').map((item) => normalize(mealTypeLabel[item.mealType])))
  const comparableMealTypes = [...reported].filter((item) => prescribed.has(item)).length
  return { total: entries.length, patientReported: entries.filter((item) => item.source === 'patient').length, professionalRecorded: entries.filter((item) => item.source === 'professional').length, incompleteQuantities: entries.filter((item) => item.foods.some((food) => !food.quantity.trim() || /não informada/i.test(food.quantity))).length, prescribedMeals: published?.meals.length ?? 0, comparableMealTypes, sourceRefs: entries.map((item) => item.id) }
}

export function generateDescriptiveInsights(workspace: NutritionWorkspace, patientId: string, range: DateRange): IntelligenceInsight[] {
  const insights: IntelligenceInsight[] = []; const assessments = workspace.assessments.filter((item) => item.patientId === patientId && inRange(item.assessedAt, range)).sort((a, b) => a.assessedAt.localeCompare(b.assessedAt)); const habits = habitIndicators(workspace, patientId, range); const diary = diaryIndicators(workspace, patientId, range)
  if (assessments.length) insights.push({ id: 'assessment-count', title: 'Avaliações no período', message: `Foram registradas ${assessments.length} ${assessments.length === 1 ? 'avaliação' : 'avaliações'} neste período.`, rule: 'Contagem de avaliações antropométricas com data dentro do intervalo.', interval: range, limitations: 'A contagem não indica frequência ideal nem resultado clínico.', sourceRefs: assessments.map((item) => item.id), href: `/pacientes/${patientId}` })
  const waist = assessments.filter((item) => item.waistCm !== undefined)
  if (waist.length >= 2) { const previous = waist.at(-2)!; const last = waist.at(-1)!; const relation = last.waistCm! < previous.waistCm! ? 'inferior à' : last.waistCm! > previous.waistCm! ? 'superior à' : 'igual à'; insights.push({ id: 'waist-latest', title: 'Últimas medidas de cintura', message: `A última medida de cintura registrada é ${relation} anterior (${last.waistCm!.toLocaleString('pt-BR')} cm e ${previous.waistCm!.toLocaleString('pt-BR')} cm).`, rule: 'Comparação aritmética das duas medidas profissionais mais recentes.', interval: { start: previous.assessedAt, end: last.assessedAt }, limitations: 'A comparação não determina causa, composição corporal, melhora ou piora da saúde.', sourceRefs: [previous.id, last.id], href: `/pacientes/${patientId}` }) }
  if (habits.barriers) insights.push({ id: 'reported-barriers', title: 'Dificuldades relatadas', message: `Foram registradas dificuldades em ${habits.barriers} ${habits.barriers === 1 ? 'acompanhamento' : 'acompanhamentos'} de metas neste período.`, rule: 'Contagem de acompanhamentos cujo campo de dificuldades contém texto.', interval: range, limitations: 'O texto exige leitura profissional e não representa classificação de adesão.', sourceRefs: habits.sourceRefs, href: `/pacientes/${patientId}` })
  if (habits.largestGapDays && habits.largestGapDays >= 30) insights.push({ id: 'habit-gap', title: 'Intervalo entre acompanhamentos', message: `O maior intervalo observado entre registros de metas foi de ${habits.largestGapDays} dias.`, rule: 'Maior diferença em dias entre acompanhamentos consecutivos.', interval: range, limitations: 'Ausência de registro não significa ausência de cuidado ou descumprimento.', sourceRefs: habits.sourceRefs, href: `/pacientes/${patientId}` })
  if (diary.patientReported < 3) insights.push({ id: 'diary-insufficient', title: 'Limitação do diário alimentar', message: 'Não há registros alimentares suficientes para avaliar tendências neste intervalo.', rule: 'Menos de três registros de autoria do paciente no período.', interval: range, limitations: 'Nenhuma informação é preenchida ou inferida para dias sem registro.', sourceRefs: diary.sourceRefs, href: `/pacientes/${patientId}` })
  else insights.push({ id: 'diary-count', title: 'Registros alimentares compartilhados', message: `O paciente compartilhou ${diary.patientReported} registros alimentares neste período.`, rule: 'Contagem de registros com origem patient.', interval: range, limitations: 'Quantidade de registros não mede adesão e o sistema não presume consumo do plano.', sourceRefs: diary.sourceRefs, href: `/pacientes/${patientId}` })
  const lastAssessment = assessments.at(-1); const publications = (workspace.mealPlanPublications ?? []).filter((item) => item.patientId === patientId && item.status === 'active' && inRange(item.publishedAt, range))
  if (lastAssessment && publications.some((item) => item.publishedAt.slice(0, 10) > lastAssessment.assessedAt)) insights.push({ id: 'plan-after-assessment', title: 'Sequência temporal do plano', message: 'Uma nova versão do plano alimentar foi disponibilizada após a última avaliação registrada.', rule: 'Comparação das datas da última avaliação e da publicação ativa.', interval: range, limitations: 'A sequência temporal não demonstra relação causal entre avaliação e plano.', sourceRefs: [lastAssessment.id, ...publications.map((item) => item.id)], href: '/planos' })
  const anamnesisChanges=anamnesisLongitudinalChanges((workspace.anamneses??[]).filter((item)=>item.patientId===patientId&&inRange(item.recordedOn,range)))
  if(anamnesisChanges.length) insights.push({id:'anamnesis-documented-changes',title:'Atualizações documentadas na anamnese',message:`A versão mais recente contém ${anamnesisChanges.length} ${anamnesisChanges.length===1?'campo diferente':'campos diferentes'} da versão anterior.`,rule:'Comparação textual entre as duas versões concluídas mais recentes da anamnese.',interval:range,limitations:'Diferença documental não significa melhora, piora, adesão ou mudança clínica confirmada.',sourceRefs:[...new Set(anamnesisChanges.flatMap((item)=>item.sourceRefs))],href:`/pacientes/${patientId}`})
  return insights
}

export function prepareFollowUpSummary(workspace: NutritionWorkspace, patientId: string, range: DateRange) {
  const patient = workspace.patients.find((item) => item.id === patientId); if (!patient) throw new Error('Paciente não encontrado.')
  const trends = anthropometricTrends(workspace.assessments.filter((item) => item.patientId === patientId), range); const habits = habitIndicators(workspace, patientId, range); const diary = diaryIndicators(workspace, patientId, range); const publications = (workspace.mealPlanPublications ?? []).filter((item) => item.patientId === patientId && inRange(item.publishedAt, range))
  const weight = trends.find((item) => item.key === 'weightKg'); const variation = weight?.absoluteChange === undefined ? 'Não há medidas suficientes para calcular variação de peso.' : `A variação aritmética entre a primeira e a última medida de peso foi de ${weight.absoluteChange.toLocaleString('pt-BR')} kg em ${weight.intervalDays} dias.`
  return `Rascunho de acompanhamento — ${patient.fullName}\nPeríodo analisado: ${range.start} a ${range.end}.\n\nAvaliações e medidas\nForam localizadas ${workspace.assessments.filter((item) => item.patientId === patientId && inRange(item.assessedAt, range)).length} avaliações no período. ${variation}\n\nHábitos e metas\n${habits.goals} metas foram registradas e existem ${habits.checkIns} acompanhamentos, dos quais ${habits.patientReports} foram relatados pelo paciente. Foram encontrados ${habits.barriers} registros com dificuldades textuais.\n\nDiário alimentar\nHá ${diary.patientReported} registros de autoria do paciente e ${diary.professionalRecorded} registros profissionais. ${diary.incompleteQuantities} registros possuem quantidade ausente ou não informada. Plano prescrito e consumo relatado permanecem separados.\n\nPlanos alimentares\nForam encontrados ${publications.length} eventos de publicação ou suspensão no período.\n\nLimitações\nEste resumo organiza dados registrados e não contém diagnóstico, inferência causal, previsão, recomendação ou avaliação automática de adesão. Períodos sem registro permanecem sem inferência. Revisão profissional obrigatória antes de qualquer utilização.`
}
