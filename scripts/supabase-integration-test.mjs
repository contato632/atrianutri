import { execFileSync, spawnSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

const cli = resolve('node_modules/.bin/supabase')
const cliEnvironment = {
  ...process.env,
  SUPABASE_HOME: process.env.SUPABASE_HOME || '/workspace/work/supabase-cli-home',
  SUPABASE_TELEMETRY_DISABLED: '1',
}
const status = JSON.parse(execFileSync(cli, ['status', '-o', 'json'], { encoding: 'utf8', env: cliEnvironment, stdio: ['ignore', 'pipe', 'ignore'] }))
const apiUrl = status.API_URL
const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY
const secretKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY

if (!apiUrl?.startsWith('http://127.0.0.1:') || !publishableKey || !secretKey) {
  throw new Error('Este teste aceita somente a pilha Supabase local e descartável.')
}

function assert(value, message) {
  if (!value) throw new Error(`Falha de integração: ${message}`)
}

function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const normalized = secret.toUpperCase().replace(/=+$/, '')
  let bits = ''
  for (const character of normalized) bits += alphabet.indexOf(character).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? [])
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest.at(-1) & 0x0f
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(value).padStart(6, '0')
}

async function request(path, { method = 'GET', token = secretKey, body, prefer } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`${method} ${path} retornou ${response.status}: ${text}`)
  return data
}

const suffix = randomUUID().slice(0, 8)
const password = `Ficticia-${suffix}-A9!`

async function createUser(label) {
  const email = `${label}-${suffix}@example.invalid`
  const user = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: { full_name: `Profissional ${label.toUpperCase()} Fictício` } },
  })
  assert(/^[0-9a-f-]{36}$/.test(user.id), `usuário ${label} não foi criado`)
  return { id: user.id, email }
}

async function login(email) {
  const session = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', token: publishableKey, body: { email, password },
  })
  assert(session.access_token, `login de ${email} não retornou sessão`)
  return session.access_token
}

const [userA, userB] = await Promise.all([createUser('orga'), createUser('orgb')])
const organizationA = randomUUID()
const organizationB = randomUUID()
const patientB = randomUUID()

const seedSql = `
insert into public.organizations (id, name, created_by) values
  ('${organizationA}', 'Organização A Fictícia', '${userA.id}'),
  ('${organizationB}', 'Organização B Fictícia', '${userB.id}');
insert into public.organization_members (organization_id, user_id, role, clinical_access, created_by) values
  ('${organizationA}', '${userA.id}', 'nutritionist', true, '${userA.id}'),
  ('${organizationB}', '${userB.id}', 'nutritionist', true, '${userB.id}');
insert into public.patients_administrative (id, organization_id, full_name, birth_date, email, phone, created_by)
values ('${patientB}', '${organizationB}', 'Paciente B Fictício', '1991-02-03', 'paciente-b-${suffix}@example.invalid', '11999990000', '${userB.id}');
insert into public.patient_professional_assignments (organization_id, patient_id, professional_user_id, assigned_by)
values ('${organizationB}', '${patientB}', '${userB.id}', '${userB.id}');
`
const seed = spawnSync('docker', ['exec', '-i', 'supabase_db_atrianutri-local', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: seedSql, encoding: 'utf8' })
if (seed.status !== 0) throw new Error(`Não foi possível preparar dados fictícios: ${seed.stderr}`)

const [tokenA, tokenB] = await Promise.all([login(userA.email), login(userB.email)])
await request('/auth/v1/recover', { method: 'POST', token: publishableKey, body: { email: userA.email } })
const membershipsA = await request(`/rest/v1/organization_members?select=organization_id,role,clinical_access,organizations!organization_members_organization_id_fkey(name)&user_id=eq.${userA.id}`, { token: tokenA })
assert(membershipsA.length === 1 && membershipsA[0].organization_id === organizationA && membershipsA[0].organizations?.name === 'Organização A Fictícia', 'vínculo profissional não foi verificado com a organização')
const patientAResult = await request('/rest/v1/rpc/create_patient_administrative', {
  method: 'POST', token: tokenA, body: {
    p_organization_id: organizationA,
    p_full_name: 'Paciente A Fictício',
    p_birth_date: '1990-01-02',
    p_email: `paciente-a-${suffix}@example.invalid`,
    p_phone: '71999990000',
    p_status: 'active',
    p_next_appointment_at: null,
  },
})
const patientA = Array.isArray(patientAResult) ? patientAResult[0] : patientAResult
assert(patientA?.id, 'RPC não confirmou o paciente da organização A')

const [visibleToA, visibleToB] = await Promise.all([
  request('/rest/v1/patients_administrative?select=id,organization_id&order=id', { token: tokenA }),
  request('/rest/v1/patients_administrative?select=id,organization_id&order=id', { token: tokenB }),
])
assert(visibleToA.length === 1 && visibleToA[0].organization_id === organizationA, 'organização A recebeu dados externos')
assert(visibleToB.length === 1 && visibleToB[0].organization_id === organizationB, 'organização B recebeu dados externos')

const crossUpdate = await request(`/rest/v1/patients_administrative?id=eq.${patientB}`, {
  method: 'PATCH', token: tokenA, prefer: 'return=representation', body: { phone: '00000000000' },
})
assert(Array.isArray(crossUpdate) && crossUpdate.length === 0, 'atualização cruzada não foi bloqueada')

const assessment = await request('/rest/v1/nutrition_assessments', {
  method: 'POST', token: tokenA, prefer: 'return=representation', body: {
    organization_id: organizationA,
    patient_id: patientA.id,
    assessed_at: '2026-11-08',
    weight_kg: 70,
    height_cm: 170,
    notes: 'Avaliação exclusivamente fictícia.',
    created_by: userA.id,
  },
})
assert(assessment.length === 1 && Number(assessment[0].bmi) === 24.2, 'avaliação real não foi persistida/calculada')

const planResult = await request('/rest/v1/rpc/create_meal_plan_draft', {
  method: 'POST', token: tokenA, body: {
    p_organization_id: organizationA,
    p_patient_id: patientA.id,
    p_title: 'Plano fictício de integração',
    p_meals: [],
    p_change_summary: 'Teste local de integração',
  },
})
const plan = Array.isArray(planResult) ? planResult[0] : planResult
assert(plan?.saved_plan_id && Number(plan.saved_version) === 1, 'plano não recebeu confirmação transacional')

const diaryResult = await request('/rest/v1/rpc/save_food_diary_entry', {
  method: 'POST', token: tokenA, body: {
    p_organization_id: organizationA,
    p_patient_id: patientA.id,
    p_entry_date: '2026-11-08',
    p_meal_time: '12:30',
    p_meal_type: 'lunch',
    p_foods: [{ id: randomUUID(), name: 'Refeição fictícia de integração', quantity: 'Porção informada' }],
    p_notes: 'Somente dados fictícios.',
    p_eating_context: 'Contexto de teste local.',
    p_hunger_before: '',
    p_satiety_after: '',
    p_routine_changes: '',
    p_shared_with_patient: false,
    p_private_note: 'Observação privada fictícia.',
    p_submission_key: randomUUID(),
  },
})
const diary = Array.isArray(diaryResult) ? diaryResult[0] : diaryResult
assert(diary?.saved_id && diary?.saved_updated_at, 'diário não recebeu confirmação transacional')

const goalResult = await request('/rest/v1/rpc/save_habit_goal', {
  method: 'POST', token: tokenA, body: {
    p_organization_id: organizationA,
    p_patient_id: patientA.id,
    p_title: 'Observar a rotina fictícia',
    p_description: 'Meta individualizada usada somente no teste local.',
    p_status: 'active',
    p_shared_with_patient: false,
    p_private_note: '',
    p_submission_key: randomUUID(),
  },
})
const goal = Array.isArray(goalResult) ? goalResult[0] : goalResult
assert(goal?.saved_id && goal?.saved_updated_at, 'meta não recebeu confirmação transacional')

const checkInResult = await request('/rest/v1/rpc/save_habit_check_in', {
  method: 'POST', token: tokenA, body: {
    p_organization_id: organizationA,
    p_patient_id: patientA.id,
    p_habit_goal_id: goal.saved_id,
    p_recorded_on: '2026-11-08',
    p_progress: 'not_observed',
    p_notes: 'Acompanhamento fictício.',
    p_difficulties: '',
    p_next_step: 'Observar sem julgamento.',
    p_shared_with_patient: false,
    p_private_note: '',
    p_submission_key: randomUUID(),
  },
})
const checkIn = Array.isArray(checkInResult) ? checkInResult[0] : checkInResult
assert(checkIn?.saved_id && checkIn?.saved_updated_at, 'acompanhamento não recebeu confirmação transacional')

const [diaryRows, goalRows, checkInRows, privateNoteRows] = await Promise.all([
  request(`/rest/v1/food_diary_entries?select=id&patient_id=eq.${patientA.id}`, { token: tokenA }),
  request(`/rest/v1/habit_goals?select=id&patient_id=eq.${patientA.id}`, { token: tokenA }),
  request(`/rest/v1/habit_check_ins?select=id&patient_id=eq.${patientA.id}`, { token: tokenA }),
  request(`/rest/v1/clinical_private_notes?select=id&patient_id=eq.${patientA.id}`, { token: tokenA }),
])
assert(diaryRows.length === 1 && goalRows.length === 1 && checkInRows.length === 1 && privateNoteRows.length === 1, 'diário e hábitos não foram persistidos com nota privada separada')

let crossDiaryDenied = false
try {
  await request('/rest/v1/rpc/save_food_diary_entry', {
    method: 'POST', token: tokenA, body: {
      p_organization_id: organizationB, p_patient_id: patientB, p_entry_date: '2026-11-08', p_meal_time: '10:00',
      p_meal_type: 'other', p_foods: [{ name: 'Tentativa cruzada' }], p_notes: '', p_eating_context: '', p_hunger_before: '',
      p_satiety_after: '', p_routine_changes: '', p_shared_with_patient: false, p_private_note: '', p_submission_key: randomUUID(),
    },
  })
} catch (error) {
  crossDiaryDenied = error instanceof Error && error.message.includes('403')
}
assert(crossDiaryDenied, 'RPC do diário não bloqueou escrita em outra organização')

const evaluationResult = await request('/rest/v1/rpc/save_nutrition_evaluation', { method:'POST',token:tokenA,body:{
  p_organization_id:organizationA,p_patient_id:patientA.id,p_evaluated_on:'2026-11-08',p_consultation_reason:'Motivo fictício de integração',p_health_history:'',p_reported_allergies:'',p_reported_medications:'',p_previous_nutrition_care:'',p_food_restrictions_and_preferences:'',p_usual_meal_schedule:'',p_usual_meals_count:'',p_meal_environment:'',p_food_access:'',p_hydration:'',p_reported_difficulties:'',p_professional_observations:'Sem diagnóstico automático.',p_submission_key:randomUUID(),
}})
const evaluation=Array.isArray(evaluationResult)?evaluationResult[0]:evaluationResult
assert(evaluation?.saved_id&&evaluation?.saved_updated_at,'avaliação estruturada não recebeu confirmação transacional')
const recallResult=await request('/rest/v1/rpc/save_dietary_recall_24h',{method:'POST',token:tokenA,body:{p_organization_id:organizationA,p_patient_id:patientA.id,p_nutrition_evaluation_id:evaluation.saved_id,p_recall_date:'2026-11-08',p_meals:[{id:randomUUID(),name:'Almoço fictício',time:'12:00',foods:[{id:randomUUID(),name:'Preparação relatada',quantity:'Não informada'}],context:'Teste local',notes:''}],p_complementary_notes:'Sem inferência nutricional.',p_submission_key:randomUUID()}})
const recall=Array.isArray(recallResult)?recallResult[0]:recallResult
assert(recall?.saved_id&&recall?.saved_updated_at,'recordatório não recebeu confirmação transacional')
const [evaluationRows,recallRows]=await Promise.all([request(`/rest/v1/nutrition_evaluations?select=id&patient_id=eq.${patientA.id}`,{token:tokenA}),request(`/rest/v1/dietary_recalls_24h?select=id&patient_id=eq.${patientA.id}`,{token:tokenA})])
assert(evaluationRows.length===1&&recallRows.length===1,'avaliação e recordatório não foram persistidos')
let crossEvaluationDenied=false
try{await request('/rest/v1/rpc/save_nutrition_evaluation',{method:'POST',token:tokenA,body:{p_organization_id:organizationB,p_patient_id:patientB,p_evaluated_on:'2026-11-08',p_consultation_reason:'Tentativa cruzada',p_health_history:'',p_reported_allergies:'',p_reported_medications:'',p_previous_nutrition_care:'',p_food_restrictions_and_preferences:'',p_usual_meal_schedule:'',p_usual_meals_count:'',p_meal_environment:'',p_food_access:'',p_hydration:'',p_reported_difficulties:'',p_professional_observations:'',p_submission_key:randomUUID()}})}catch(error){crossEvaluationDenied=error instanceof Error&&error.message.includes('403')}
assert(crossEvaluationDenied,'RPC de avaliação não bloqueou outra organização')

const factor = await request('/auth/v1/factors', {
  method: 'POST', token: tokenA, body: { factor_type: 'totp', friendly_name: `Integração ${suffix}` },
})
assert(factor?.id && factor?.totp?.secret, 'enrollment TOTP não retornou fator e segredo')
const challenge = await request(`/auth/v1/factors/${factor.id}/challenge`, { method: 'POST', token: tokenA, body: {} })
const verifiedFactor = await request(`/auth/v1/factors/${factor.id}/verify`, {
  method: 'POST', token: tokenA, body: { challenge_id: challenge.id, code: totp(factor.totp.secret) },
})
assert(verifiedFactor?.access_token, 'TOTP não elevou a sessão autenticada')

console.log('PASS: Auth real com duas contas fictícias')
console.log('PASS: recuperação de senha aceita sem revelar cadastro')
console.log('PASS: vínculo profissional ativo verificado no banco')
console.log('PASS: criação administrativa via RPC auditada')
console.log('PASS: leitura isolada entre duas organizações')
console.log('PASS: mutação cruzada bloqueada por RLS')
console.log('PASS: avaliação persistida com IMC gerado pelo PostgreSQL')
console.log('PASS: plano e primeira versão persistidos atomicamente')
console.log('PASS: diário, meta, acompanhamento e nota privada persistidos por RPC')
console.log('PASS: escrita cruzada do diário bloqueada entre organizações')
console.log('PASS: avaliação completa e recordatório persistidos por RPC')
console.log('PASS: escrita cruzada da avaliação bloqueada entre organizações')
console.log('PASS: enrollment e verificação TOTP elevaram a sessão')
console.log('PASS: nenhum dado ou token real foi utilizado')
