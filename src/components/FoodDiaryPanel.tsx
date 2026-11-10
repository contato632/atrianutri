import { CalendarDays, ChevronDown, ChevronUp, CircleDot, Clock3, Edit3, Flag, LockKeyhole, Plus, Sprout, Utensils } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FoodDiaryEntry, FoodDiaryMealType, HabitCheckIn, HabitGoal } from '../domain/models'
import { filterFoodDiaryEntries } from '../domain/foodDiary'
import { formatDate } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'
import { EmptyState } from './EmptyState'
import { FoodDiaryForm } from './FoodDiaryForm'
import { HabitCheckInForm } from './HabitCheckInForm'
import { HabitGoalForm } from './HabitGoalForm'
import { Modal } from './Modal'

const mealLabels: Record<FoodDiaryMealType, string> = { breakfast: 'Café da manhã', 'morning-snack': 'Lanche da manhã', lunch: 'Almoço', 'afternoon-snack': 'Lanche da tarde', dinner: 'Jantar', 'evening-snack': 'Ceia', other: 'Outro' }
const progressLabels: Record<HabitCheckIn['progress'], string> = { progressing: 'Percebe progresso', maintaining: 'Mantém o combinado', difficulty: 'Encontrou dificuldade', 'not-observed': 'Ainda não observado' }
const statusLabels: Record<HabitGoal['status'], string> = { active: 'Em acompanhamento', paused: 'Pausada', completed: 'Concluída' }

type Editor = { kind: 'entry'; value?: FoodDiaryEntry } | { kind: 'goal'; value?: HabitGoal } | { kind: 'checkin'; value?: HabitCheckIn; goalId?: string } | null

export function FoodDiaryPanel({ patientId }: { patientId: string }) {
  const { workspace, saveFoodDiaryEntry, saveHabitGoal, saveHabitCheckIn } = useWorkspace()
  const [area, setArea] = useState<'diary' | 'habits'>('diary')
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'all'>('30')
  const [mealType, setMealType] = useState<'all' | FoodDiaryMealType>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor>(null)
  const entries = useMemo(() => workspace.foodDiaryEntries.filter((entry) => entry.patientId === patientId).sort((a, b) => `${b.entryDate}${b.mealTime}`.localeCompare(`${a.entryDate}${a.mealTime}`)), [workspace.foodDiaryEntries, patientId])
  const goals = useMemo(() => workspace.habitGoals.filter((goal) => goal.patientId === patientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [workspace.habitGoals, patientId])
  const checkIns = useMemo(() => workspace.habitCheckIns.filter((item) => item.patientId === patientId).sort((a, b) => b.recordedOn.localeCompare(a.recordedOn)), [workspace.habitCheckIns, patientId])
  const latestDate = entries[0]?.entryDate
  const filtered = filterFoodDiaryEntries(entries, period, mealType)
  const grouped = Object.entries(filtered.reduce<Record<string, FoodDiaryEntry[]>>((days, entry) => {
    ;(days[entry.entryDate] ??= []).push(entry)
    return days
  }, {}))
  const recentSeven = latestDate ? entries.filter((entry) => new Date(`${entry.entryDate}T12:00:00Z`).getTime() >= new Date(`${latestDate}T12:00:00Z`).getTime() - 6 * 86400000).length : 0
  const activeGoals = goals.filter((goal) => goal.status === 'active').length

  return <section className="panel diary-module">
    <header className="diary-module__header"><div><span className="eyebrow">Acompanhamento entre consultas</span><h3><Utensils size={18} /> Diário alimentar</h3><p>Padrões, contexto, dificuldades e hábitos registrados sem julgamentos automáticos.</p></div><div className="diary-area-switch" role="tablist" aria-label="Áreas do acompanhamento"><button className={area === 'diary' ? 'active' : ''} onClick={() => setArea('diary')} role="tab" aria-selected={area === 'diary'}>Registros</button><button className={area === 'habits' ? 'active' : ''} onClick={() => setArea('habits')} role="tab" aria-selected={area === 'habits'}>Hábitos e metas</button></div></header>
    {area === 'diary' ? <>
      <div className="diary-summary"><div><strong>{recentSeven}</strong><span>registros nos 7 dias mais recentes</span></div><div><strong>{new Set(entries.map((entry) => entry.mealType)).size}</strong><span>tipos de refeição observados</span></div><div><strong>{entries.filter((entry) => entry.source === 'patient').length}</strong><span>registros informados pelo paciente</span></div></div>
      <div className="diary-toolbar"><div className="diary-filters"><label><span>Período</span><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="all">Todo o histórico</option></select></label><label><span>Tipo de refeição</span><select value={mealType} onChange={(event) => setMealType(event.target.value as typeof mealType)}><option value="all">Todos</option>{Object.entries(mealLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><button className="button button--primary" type="button" onClick={() => setEditor({ kind: 'entry' })}><Plus size={16} /> Nova entrada</button></div>
      {filtered.length ? <div className="diary-timeline">{grouped.map(([date, dayEntries]) => <section key={date} className="diary-day"><header><CalendarDays size={15} /><strong>{formatDate(date)}</strong><span>{dayEntries?.length} {dayEntries?.length === 1 ? 'registro' : 'registros'}</span></header>{dayEntries?.map((entry) => { const open = expanded === entry.id; return <article className="diary-entry" key={entry.id}><button type="button" className="diary-entry__summary" onClick={() => setExpanded(open ? null : entry.id)} aria-expanded={open}><span className="meal-time"><Clock3 size={14} />{entry.mealTime}</span><div><strong>{mealLabels[entry.mealType]}</strong><span>{entry.foods.map((food) => food.name).join(' · ')}</span></div><span className={`source-chip source-chip--${entry.source}`}>{entry.source === 'patient' ? 'Paciente' : 'Profissional'}</span>{open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>{open && <div className="diary-entry__detail"><dl><div><dt>Itens informados</dt><dd>{entry.foods.map((food) => <span key={food.id}>{food.name}{food.quantity ? ` — ${food.quantity}` : ''}</span>)}</dd></div>{entry.eatingContext && <div><dt>Contexto</dt><dd>{entry.eatingContext}</dd></div>}{entry.notes && <div><dt>Observações</dt><dd>{entry.notes}</dd></div>}{entry.hungerBefore && <div><dt>Fome antes</dt><dd>{entry.hungerBefore}</dd></div>}{entry.satietyAfter && <div><dt>Saciedade depois</dt><dd>{entry.satietyAfter}</dd></div>}{entry.routineChanges && <div><dt>Rotina e dificuldades</dt><dd>{entry.routineChanges}</dd></div>}</dl>{entry.professionalPrivateNote && <p className="private-note"><LockKeyhole size={14} /><span><strong>Observação privada</strong>{entry.professionalPrivateNote}</span></p>}<button className="text-button" type="button" onClick={() => setEditor({ kind: 'entry', value: entry })}><Edit3 size={14} /> Editar registro</button></div>}</article>})}</section>)}</div> : <EmptyState icon={Utensils} title="Nenhum registro neste período" description="Ajuste os filtros ou registre uma refeição informada pelo paciente." action={<button className="button button--soft" onClick={() => setEditor({ kind: 'entry' })}>Registrar entrada</button>} />}
    </> : <>
      <div className="habit-overview"><div><strong>{activeGoals}</strong><span>metas em acompanhamento</span></div><p>Metas individualizadas valorizam progresso, contexto e dificuldades — sem pontuação ou cobrança.</p><div><button className="button button--soft" type="button" onClick={() => setEditor({ kind: 'checkin' })} disabled={!goals.length}><CircleDot size={16} /> Registrar acompanhamento</button><button className="button button--primary" type="button" onClick={() => setEditor({ kind: 'goal' })}><Plus size={16} /> Nova meta</button></div></div>
      {goals.length ? <div className="habit-list">{goals.map((goal) => { const latest = checkIns.find((item) => item.goalId === goal.id); return <article className="habit-row" key={goal.id}><span className={`habit-marker habit-marker--${goal.status}`}><Flag size={16} /></span><div className="habit-row__content"><header><strong>{goal.title}</strong><span>{statusLabels[goal.status]}</span></header>{goal.description && <p>{goal.description}</p>}{latest ? <div className="habit-latest"><span>{formatDate(latest.recordedOn)}</span><strong>{progressLabels[latest.progress]}</strong>{latest.difficulties && <p>{latest.difficulties}</p>}</div> : <small>Ainda sem acompanhamento registrado.</small>}</div><div className="habit-actions"><button className="text-button" type="button" onClick={() => setEditor({ kind: 'checkin', goalId: goal.id })}>Acompanhar</button><button className="icon-button" type="button" onClick={() => setEditor({ kind: 'goal', value: goal })} aria-label={`Editar ${goal.title}`}><Edit3 size={15} /></button></div></article>})}</div> : <EmptyState icon={Sprout} title="Nenhuma meta individualizada" description="Crie metas a partir da avaliação e da realidade deste paciente, sem recomendações universais." action={<button className="button button--primary" onClick={() => setEditor({ kind: 'goal' })}>Criar primeira meta</button>} />}
    </>}
    {editor?.kind === 'entry' && <Modal title={editor.value ? 'Editar entrada do diário' : 'Nova entrada no diário'} eyebrow="Registro clínico contextual" size="large" onClose={() => setEditor(null)}><FoodDiaryForm patientId={patientId} entry={editor.value} onCancel={() => setEditor(null)} onSubmit={async (input) => { await saveFoodDiaryEntry(input, editor.value); setEditor(null) }} /></Modal>}
    {editor?.kind === 'goal' && <Modal title={editor.value ? 'Editar meta de hábito' : 'Nova meta de hábito'} eyebrow="Acompanhamento individualizado" size="large" onClose={() => setEditor(null)}><HabitGoalForm patientId={patientId} goal={editor.value} onCancel={() => setEditor(null)} onSubmit={async (input) => { await saveHabitGoal(input, editor.value); setEditor(null) }} /></Modal>}
    {editor?.kind === 'checkin' && <Modal title={editor.value ? 'Editar acompanhamento' : 'Acompanhar hábito'} eyebrow="Progresso e dificuldades" size="large" onClose={() => setEditor(null)}><HabitCheckInForm patientId={patientId} goals={goals} checkIn={editor.value} initialGoalId={editor.goalId} onCancel={() => setEditor(null)} onSubmit={async (input) => { await saveHabitCheckIn(input, editor.value); setEditor(null) }} /></Modal>}
  </section>
}
