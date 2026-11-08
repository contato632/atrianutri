import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { FoodDiaryEntry, FoodDiaryEntryInput, FoodDiaryMealType } from '../domain/models'
import { foodDiaryEntrySchema } from '../domain/validation'

const mealOptions: Array<[FoodDiaryMealType, string]> = [
  ['breakfast', 'Café da manhã'], ['morning-snack', 'Lanche da manhã'], ['lunch', 'Almoço'],
  ['afternoon-snack', 'Lanche da tarde'], ['dinner', 'Jantar'], ['evening-snack', 'Ceia'], ['other', 'Outro'],
]

export function FoodDiaryForm({ patientId, entry, onCancel, onSubmit }: { patientId: string; entry?: FoodDiaryEntry; onCancel: () => void; onSubmit: (input: FoodDiaryEntryInput) => Promise<void> }) {
  const [foods, setFoods] = useState(entry?.foods ?? [{ id: crypto.randomUUID(), name: '', quantity: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const data = new FormData(event.currentTarget)
    const result = foodDiaryEntrySchema.safeParse({
      patientId, entryDate: data.get('entryDate'), mealTime: data.get('mealTime'), mealType: data.get('mealType'), foods,
      notes: data.get('notes'), eatingContext: data.get('eatingContext'), hungerBefore: data.get('hungerBefore'), satietyAfter: data.get('satietyAfter'), routineChanges: data.get('routineChanges'),
      sharedWithPatient: data.get('sharedWithPatient') === 'on', professionalPrivateNote: data.get('professionalPrivateNote'), submissionKey: entry?.submissionKey ?? crypto.randomUUID(),
    })
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Revise os campos informados.'); return }
    setBusy(true)
    try { await onSubmit(result.data) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o registro.') } finally { setBusy(false) }
  }

  return <form className="form-stack diary-form" onSubmit={submit}>
    <div className="field-grid field-grid--4">
      <label className="field"><span>Data</span><input type="date" name="entryDate" defaultValue={entry?.entryDate ?? new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} required /></label>
      <label className="field"><span>Horário</span><input type="time" name="mealTime" defaultValue={entry?.mealTime ?? '12:00'} required /></label>
      <label className="field field--span-2"><span>Tipo de refeição</span><select name="mealType" defaultValue={entry?.mealType ?? 'lunch'}>{mealOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <fieldset className="diary-foods"><legend>Alimentos e preparações</legend>{foods.map((food, index) => <div className="diary-food-row" key={food.id}><label className="field"><span>{index === 0 ? 'Alimento ou preparação' : `Item ${index + 1}`}</span><input value={food.name} maxLength={300} onChange={(event) => setFoods((current) => current.map((item) => item.id === food.id ? { ...item, name: event.target.value } : item))} placeholder="Conforme informado pelo paciente" required /></label><label className="field"><span>Quantidade, se disponível</span><input value={food.quantity} maxLength={200} onChange={(event) => setFoods((current) => current.map((item) => item.id === food.id ? { ...item, quantity: event.target.value } : item))} placeholder="Opcional" /></label><button type="button" className="icon-button danger" onClick={() => setFoods((current) => current.filter((item) => item.id !== food.id))} disabled={foods.length === 1} aria-label="Remover item"><Trash2 size={16} /></button></div>)}<button className="text-button" type="button" onClick={() => setFoods((current) => [...current, { id: crypto.randomUUID(), name: '', quantity: '' }])}><Plus size={15} /> Adicionar item</button></fieldset>
    <div className="field-grid field-grid--2"><label className="field"><span>Contexto da alimentação <small>opcional</small></span><textarea name="eatingContext" defaultValue={entry?.eatingContext} maxLength={2000} rows={3} placeholder="Onde, com quem ou em qual situação ocorreu" /></label><label className="field"><span>Observações sobre a refeição <small>opcional</small></span><textarea name="notes" defaultValue={entry?.notes} maxLength={4000} rows={3} /></label></div>
    <div className="field-grid field-grid--2"><label className="field"><span>Fome antes da refeição <small>opcional</small></span><input name="hungerBefore" defaultValue={entry?.hungerBefore} maxLength={500} placeholder="Descrição livre, sem nota" /></label><label className="field"><span>Saciedade após a refeição <small>opcional</small></span><input name="satietyAfter" defaultValue={entry?.satietyAfter} maxLength={500} placeholder="Descrição livre, sem nota" /></label></div>
    <label className="field"><span>Dificuldades ou mudanças de rotina <small>opcional</small></span><textarea name="routineChanges" defaultValue={entry?.routineChanges} maxLength={4000} rows={3} /></label>
    <label className="field private-field"><span>Observação clínica privada <small>nunca compartilhada automaticamente</small></span><textarea name="professionalPrivateNote" defaultValue={entry?.professionalPrivateNote} maxLength={4000} rows={3} /></label>
    <label className="check-field"><input type="checkbox" name="sharedWithPatient" defaultChecked={entry?.sharedWithPatient} /><span>Marcar este registro como compartilhado com o paciente</span></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button button--ghost" type="button" onClick={onCancel}>Cancelar</button><button className="button button--primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Save size={16} />}{entry ? 'Salvar alterações' : 'Registrar refeição'}</button></div>
  </form>
}
