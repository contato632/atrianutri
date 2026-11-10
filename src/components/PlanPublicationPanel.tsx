import { Eye, EyeOff, Send } from 'lucide-react'
import { useState } from 'react'
import type { MealPlan } from '../domain/models'
import { formatDateTime } from '../lib/format'
import { useWorkspace } from '../state/WorkspaceContext'

export function PlanPublicationPanel({ plan }: { plan: MealPlan }) {
  const { workspace, publishMealPlanVersion, revokeMealPlanPublication } = useWorkspace()
  const active = (workspace.mealPlanPublications ?? []).find((item) => item.mealPlanId === plan.id && item.status === 'active')
  const history = (workspace.mealPlanPublications ?? []).filter((item) => item.mealPlanId === plan.id).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const versions = [...plan.revisions].sort((a, b) => b.version - a.version)
  const [version, setVersion] = useState(active?.version ?? plan.version)
  const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState('')
  async function run(action: () => Promise<unknown>, message: string) { setBusy(true); setFeedback(''); try { await action(); setFeedback(message) } catch (reason) { setFeedback(reason instanceof Error ? reason.message : 'Não foi possível concluir.') } finally { setBusy(false) } }
  return <section className="panel publication-panel"><header><Eye size={17} /><div><span className="eyebrow">Portal do paciente</span><h3>Disponibilizar ao paciente</h3></div></header>{versions.length ? <><label><span>Versão aprovada pelo profissional</span><select value={version} onChange={(event) => setVersion(Number(event.target.value))}>{versions.map((item) => <option value={item.version} key={item.version}>Versão {item.version} · {formatDateTime(item.savedAt)}</option>)}</select></label><button type="button" className="button button--primary" disabled={busy || active?.version === version} onClick={() => void run(() => publishMealPlanVersion(plan.id, version), `Versão ${version} disponibilizada ao paciente.`)}><Send size={15} />{active ? 'Substituir versão publicada' : 'Disponibilizar ao paciente'}</button>{active && <div className="publication-active"><span><Eye size={14} /> Versão {active.version} disponível desde {formatDateTime(active.publishedAt)}</span><button type="button" className="text-button" disabled={busy} onClick={() => void run(() => revokeMealPlanPublication(active.id), 'Compartilhamento suspenso.')}><EyeOff size={14} /> Suspender</button></div>}</> : <p className="muted-copy">Salve e revise uma versão antes de disponibilizar.</p>}{feedback && <p className="connection-feedback" role="status">{feedback}</p>}{history.length > 1 && <details><summary>Histórico de publicação</summary>{history.map((item) => <div key={item.id}><strong>Versão {item.version}</strong><span>{item.status === 'active' ? 'Disponível' : 'Suspensa'} · {formatDateTime(item.publishedAt)}</span></div>)}</details>}<p className="privacy-note">Alterações no rascunho não modificam a versão já publicada.</p></section>
}
