import { LoaderCircle, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { HabitGoal, HabitGoalInput } from '../domain/models'
import { habitGoalSchema } from '../domain/validation'

export function HabitGoalForm({ patientId, goal, onCancel, onSubmit }: { patientId: string; goal?: HabitGoal; onCancel: () => void; onSubmit: (input: HabitGoalInput) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const data = new FormData(event.currentTarget)
    const result = habitGoalSchema.safeParse({ patientId, title: data.get('title'), description: data.get('description'), status: data.get('status'), sharedWithPatient: data.get('sharedWithPatient') === 'on', professionalPrivateNote: data.get('professionalPrivateNote'), submissionKey: goal?.submissionKey ?? crypto.randomUUID() })
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Revise os campos.'); return }
    setBusy(true); try { await onSubmit(result.data) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a meta.') } finally { setBusy(false) }
  }
  return <form className="form-stack" onSubmit={submit}><label className="field"><span>Hábito ou meta individualizada</span><input name="title" defaultValue={goal?.title} maxLength={200} placeholder="Definido em conjunto com o paciente" required /></label><label className="field"><span>Contexto e intenção <small>opcional</small></span><textarea name="description" defaultValue={goal?.description} maxLength={4000} rows={4} /></label><label className="field"><span>Estado</span><select name="status" defaultValue={goal?.status ?? 'active'}><option value="active">Em acompanhamento</option><option value="paused">Pausada</option><option value="completed">Concluída</option></select></label><label className="field private-field"><span>Observação clínica privada</span><textarea name="professionalPrivateNote" defaultValue={goal?.professionalPrivateNote} maxLength={4000} rows={3} /></label><label className="check-field"><input type="checkbox" name="sharedWithPatient" defaultChecked={goal?.sharedWithPatient} /><span>Compartilhar esta meta com o paciente</span></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button--ghost" type="button" onClick={onCancel}>Cancelar</button><button className="button button--primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Save size={16} />}{goal ? 'Salvar meta' : 'Criar meta'}</button></div></form>
}
