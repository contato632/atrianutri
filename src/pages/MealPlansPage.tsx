import { AlertTriangle, Check, ChevronDown, Clock3, History, Plus, Save, Trash2, Utensils, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FoodItem, Meal, MealPlan } from '../domain/models'
import { formatDate, formatDateTime } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const createEmptyPlan = (patientId: string): MealPlan => ({ id: newId('plan'), patientId, title: 'Novo plano alimentar', status: 'draft', version: 0, updatedAt: new Date().toISOString(), meals: [], revisions: [] })

export function MealPlansPage() {
  const { workspace, loading, saveMealPlan } = useWorkspace()
  const initialPatientId = workspace.mealPlans[0]?.patientId ?? workspace.patients[0]?.id ?? ''
  const [patientId, setPatientId] = useState(initialPatientId)
  const selectedStoredPlan = useMemo(() => workspace.mealPlans.find((item) => item.patientId === patientId), [workspace.mealPlans, patientId])
  const [draft, setDraft] = useState<MealPlan | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!patientId && workspace.patients.length) setPatientId(workspace.mealPlans[0]?.patientId ?? workspace.patients[0].id)
  }, [patientId, workspace.patients, workspace.mealPlans])

  useEffect(() => {
    if (!patientId) return
    setDraft(structuredClone(selectedStoredPlan ?? createEmptyPlan(patientId)))
    setDirty(false)
  }, [patientId, selectedStoredPlan])

  function updateDraft(transform: (current: MealPlan) => MealPlan) {
    setDraft((current) => current ? transform(current) : current)
    setDirty(true)
    setSaved(false)
  }

  function updateMeal(mealId: string, patch: Partial<Meal>) {
    updateDraft((current) => ({ ...current, meals: current.meals.map((meal) => meal.id === mealId ? { ...meal, ...patch } : meal) }))
  }

  function updateFood(mealId: string, foodId: string, patch: Partial<FoodItem>) {
    updateDraft((current) => ({ ...current, meals: current.meals.map((meal) => meal.id === mealId ? { ...meal, foods: meal.foods.map((food) => food.id === foodId ? { ...food, ...patch } : food) } : meal) }))
  }

  async function save() {
    if (!draft || !draft.title.trim()) return
    setSaving(true)
    try {
      const result = await saveMealPlan(draft, draft.version ? 'Conteúdo e orientações atualizados' : 'Rascunho inicial criado')
      setDraft(result)
      setDirty(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  if (loading || !draft) return <div className="skeleton-list"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
  const patient = workspace.patients.find((item) => item.id === patientId)

  return (
    <div className="page-stack meal-plan-page">
      <section className="section-intro"><div><h2>Editor de plano alimentar</h2><p>Construa manualmente uma orientação individualizada, refeição por refeição.</p></div><div className="save-state">{dirty ? <><span className="unsaved-dot" /> Alterações nesta sessão</> : saved ? <><Check size={15} /> Rascunho salvo na sessão</> : <>Versão {draft.version || 'nova'}</>}<button type="button" className="button button--primary" onClick={() => void save()} disabled={saving || !dirty}><Save size={17} />{saving ? 'Salvando…' : 'Salvar rascunho'}</button></div></section>

      <div className="plan-toolbar panel">
        <label><span>Paciente</span><div className="select-shell"><select value={patientId} onChange={(event) => setPatientId(event.target.value)}>{workspace.patients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select><ChevronDown size={16} /></div></label>
        <label className="plan-title-field"><span>Nome do plano</span><input value={draft.title} onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))} /></label>
        <div className="plan-meta"><span>Status</span><strong><i /> Rascunho</strong></div>
      </div>

      <div className="plan-layout">
        <section className="meal-editor">
          <div className="editor-heading"><div><span className="eyebrow">Estrutura diária</span><h3>Refeições e orientações</h3></div><button type="button" className="button button--soft" onClick={() => updateDraft((current) => ({ ...current, meals: [...current.meals, { id: newId('meal'), name: 'Nova refeição', time: '12:00', guidance: '', foods: [] }] }))}><Plus size={16} /> Adicionar refeição</button></div>
          {draft.meals.length ? draft.meals.map((meal, mealIndex) => <article className="meal-card panel" key={meal.id}>
            <header className="meal-card__header"><span className="meal-index">{String(mealIndex + 1).padStart(2, '0')}</span><input className="meal-name-input" value={meal.name} onChange={(event) => updateMeal(meal.id, { name: event.target.value })} aria-label="Nome da refeição" /><label className="time-input"><Clock3 size={15} /><input type="time" value={meal.time} onChange={(event) => updateMeal(meal.id, { time: event.target.value })} aria-label="Horário" /></label><button type="button" className="icon-button danger" onClick={() => updateDraft((current) => ({ ...current, meals: current.meals.filter((item) => item.id !== meal.id) }))} aria-label={`Remover ${meal.name}`}><Trash2 size={16} /></button></header>
            <div className="food-table"><div className="food-table__head"><span>Alimento ou preparação</span><span>Quantidade / porção</span><span /></div>{meal.foods.map((food) => <div className="food-row" key={food.id}><input value={food.name} onChange={(event) => updateFood(meal.id, food.id, { name: event.target.value })} placeholder="Definido pelo nutricionista" aria-label="Alimento ou preparação" /><input value={food.quantity} onChange={(event) => updateFood(meal.id, food.id, { quantity: event.target.value })} placeholder="Ex.: 1 porção" aria-label="Quantidade ou porção" /><button type="button" onClick={() => updateMeal(meal.id, { foods: meal.foods.filter((item) => item.id !== food.id) })} aria-label="Remover alimento"><X size={15} /></button></div>)}</div>
            <button type="button" className="add-food" onClick={() => updateMeal(meal.id, { foods: [...meal.foods, { id: newId('food'), name: '', quantity: '' }] })}><Plus size={15} /> Adicionar item manualmente</button>
            <label className="guidance-field"><span>Orientações para esta refeição</span><textarea value={meal.guidance} onChange={(event) => updateMeal(meal.id, { guidance: event.target.value })} placeholder="Contexto, substituições já validadas ou observações de rotina…" rows={2} /></label>
          </article>) : <div className="empty-meals panel"><span><Utensils size={22} /></span><h3>Comece pelas refeições</h3><p>Adicione somente orientações definidas pelo profissional. Nenhuma informação nutricional será preenchida automaticamente.</p><button className="button button--primary" type="button" onClick={() => updateDraft((current) => ({ ...current, meals: [{ id: newId('meal'), name: 'Café da manhã', time: '07:30', guidance: '', foods: [] }] }))}><Plus size={16} /> Adicionar primeira refeição</button></div>}
        </section>

        <aside className="plan-sidebar">
          <section className="panel safety-card"><span className="safety-card__icon"><AlertTriangle size={18} /></span><div><h3>Construção manual</h3><p>O AtriaNutri não sugere alimentos, porções ou prescrições. Todo conteúdo é definido e revisado pelo nutricionista.</p></div></section>
          <section className="panel revision-card"><header><History size={17} /><div><span className="eyebrow">Histórico</span><h3>Versões do rascunho</h3></div></header>{draft.revisions.length ? <div className="revision-list">{[...draft.revisions].reverse().map((revision, index) => <article key={`${revision.version}-${revision.savedAt}`}><span className={index === 0 ? 'current' : ''} /><div><strong>Versão {revision.version}</strong><small>{formatDateTime(revision.savedAt)}</small><p>{revision.summary}</p></div></article>)}</div> : <p className="muted-copy">A primeira versão aparecerá após salvar o rascunho.</p>}</section>
          <section className="panel patient-context"><span className="eyebrow">Contexto</span><h3>{patient?.fullName}</h3><p>O plano está vinculado somente a este paciente na organização atual.</p><div><span>Última atualização</span><strong>{draft.version ? formatDate(draft.updatedAt) : 'Ainda não salvo'}</strong></div></section>
        </aside>
      </div>
    </div>
  )
}
