import type { AnamnesisAnswer, AnamnesisInput, AnamnesisRecord, NutritionWorkspace } from './models'

export const anamnesisSections = [
  { id: 'identification', title: 'Identificação e motivo', description: 'Demanda, objetivos e expectativas relatadas.', fields: [['consultationReason','Motivo do atendimento'],['reportedGoals','Objetivos relatados'],['followUpHistory','Histórico do acompanhamento'],['expectations','Expectativas do paciente']] },
  { id: 'health', title: 'Histórico de saúde', description: 'Informações relatadas, sem confirmação diagnóstica.', fields: [['reportedConditions','Condições de saúde relatadas'],['medications','Medicamentos'],['supplements','Suplementos'],['allergiesIntolerances','Alergias e intolerâncias relatadas'],['surgeries','Cirurgias'],['familyHistory','Histórico familiar relevante'],['otherProfessionals','Acompanhamentos por outros profissionais']] },
  { id: 'food', title: 'Histórico alimentar', description: 'Rotina, acesso e organização das refeições.', fields: [['usualMealsCount','Número habitual de refeições'],['mealTimes','Horários habituais'],['foodAtWork','Alimentação no trabalho'],['eatingOut','Alimentação fora de casa'],['preferences','Preferências'],['restrictions','Restrições relatadas'],['avoidedFoods','Alimentos evitados'],['foodAccess','Acesso e disponibilidade'],['mealOrganization','Organização das refeições'],['reportedHydration','Hidratação relatada']] },
  { id: 'routine', title: 'Rotina e hábitos', description: 'Hábitos autorrelatados e contexto cotidiano.', fields: [['sleep','Sono'],['physicalActivity','Atividade física'],['workRoutine','Rotina profissional'],['reportedActivityLevel','Nível de atividade autorrelatado'],['reportedAlcohol','Consumo de álcool relatado'],['reportedSmoking','Tabagismo relatado'],['foodBarriers','Barreiras à alimentação']] },
  { id: 'behavior', title: 'Comportamento alimentar', description: 'Linguagem descritiva e não moralizante.', fields: [['hungerPerception','Percepção de fome'],['satietyPerception','Percepção de saciedade'],['emotionalContext','Contexto emocional das refeições'],['reportedLossOfControl','Episódios de perda de controle relatados'],['eatingDifficulties','Dificuldades com a alimentação'],['dietHistory','Histórico de dietas']] },
  { id: 'gastrointestinal', title: 'Sintomas gastrointestinais', description: 'Sintomas e contexto, sem atribuição automática de causas.', fields: [['reportedSymptoms','Sintomas relatados'],['symptomFrequency','Frequência'],['symptomDuration','Duração'],['symptomContext','Contexto']] },
] as const

export type AnamnesisFieldKey = string
const fieldPairs: Array<readonly [string,string]> = []
for (const section of anamnesisSections) for (const field of section.fields) fieldPairs.push(field)
export const anamnesisFieldLabels = Object.fromEntries(fieldPairs) as Record<AnamnesisFieldKey, string>
export const anamnesisFieldKeys = Object.keys(anamnesisFieldLabels)

export const emptyAnamnesisAnswers = (source: AnamnesisAnswer['source'] = 'professional') => Object.fromEntries(anamnesisFieldKeys.map((key) => [key, { value: '', state: 'not-informed', source }])) as Record<string, AnamnesisAnswer>

export function anamnesisProgress(answers: Record<string, AnamnesisAnswer>) {
  const documented = anamnesisFieldKeys.filter((key) => answers[key]?.state !== 'not-informed').length
  return { documented, total: anamnesisFieldKeys.length, percentage: Math.round(documented / anamnesisFieldKeys.length * 100) }
}

export function validateAnamnesis(input: AnamnesisInput) {
  const invalid = Object.entries(input.answers).find(([, answer]) => answer.state === 'informed' && !answer.value.trim())
  if (invalid) throw new Error(`Preencha “${anamnesisFieldLabels[invalid[0] as AnamnesisFieldKey] ?? invalid[0]}” ou marque como não informado/desconhecido.`)
  if (input.status === 'completed' && anamnesisProgress(input.answers).documented === 0) throw new Error('Registre ao menos uma informação antes de concluir a anamnese.')
}

export function anamnesisLongitudinalChanges(records: AnamnesisRecord[]) {
  const ordered = [...records].filter((item) => item.status === 'completed').sort((a, b) => a.version - b.version)
  if (ordered.length < 2) return []
  const previous = ordered.at(-2)!; const current = ordered.at(-1)!
  return anamnesisFieldKeys.flatMap((key) => {
    const before = previous.answers[key]; const after = current.answers[key]
    if (!after || `${before?.state}:${before?.value}` === `${after.state}:${after.value}`) return []
    return [{ key, label: anamnesisFieldLabels[key], previous: before, current: after, sourceRefs: [previous.id, current.id] }]
  })
}

export function authorizedAnamnesisSummary(workspace: NutritionWorkspace, patientId: string, authorizedFields: string[]) {
  const current = [...(workspace.anamneses ?? [])].filter((item) => item.patientId === patientId && item.status === 'completed').sort((a, b) => b.version - a.version)[0]
  if (!current) return []
  return authorizedFields.flatMap((key) => {
    const answer = current.answers[key]
    return answer?.state === 'informed' && answer.value.trim() ? [{ key, label: anamnesisFieldLabels[key as AnamnesisFieldKey] ?? key, value: answer.value, source: answer.source, sourceRef: current.id }] : []
  })
}
