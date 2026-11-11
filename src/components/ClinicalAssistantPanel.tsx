import { Bot, Check, ClipboardCopy, ExternalLink, LoaderCircle, PencilLine, ShieldCheck, Sparkles, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildClinicalAiRequest, prepareAuthorizedClinicalContext, responseToEditableDraft, runClinicalAiOperation, SimulatedClinicalAiProvider, UsageLedger, type AiAccessScope, type ClinicalAiResponse, type ClinicalAiTool, type ClinicalSectionKey, type UsageMetadata } from '../ai/clinicalAssistant'
import type { DateRange } from '../domain/nutritionIntelligence'
import type { NutritionWorkspace } from '../domain/models'

const tools: { id: ClinicalAiTool; title: string; description: string }[] = [
  { id: 'evolution-analysis', title: 'Analisar evolução', description: 'Organiza fatos e diferenças matemáticas do período.' },
  { id: 'appointment-preparation', title: 'Preparar consulta', description: 'Reúne registros úteis para revisão antes do atendimento.' },
  { id: 'investigation-questions', title: 'Sugerir perguntas', description: 'Cria perguntas abertas apoiadas nos registros selecionados.' },
  { id: 'clinical-summary', title: 'Rascunhar resumo', description: 'Monta um texto editável, sem diagnóstico ou conduta.' },
]
const sectionLabels: Record<ClinicalSectionKey, string> = { documented: 'Informações documentadas', trends: 'Tendências observadas', investigation: 'Pontos para investigação', limitations: 'Limitações' }
const sectionKeys = Object.keys(sectionLabels) as ClinicalSectionKey[]
const provider = new SimulatedClinicalAiProvider()
const ledger = new UsageLedger()

type Props = { workspace: NutritionWorkspace; patientId: string; range: DateRange }

export function ClinicalAssistantPanel({ workspace, patientId, range }: Props) {
  const [tool, setTool] = useState<ClinicalAiTool>('evolution-analysis')
  const [selectedSections, setSelectedSections] = useState<ClinicalSectionKey[]>(sectionKeys)
  const [response, setResponse] = useState<ClinicalAiResponse | null>(null)
  const [usage, setUsage] = useState<UsageMetadata | null>(null)
  const [draft, setDraft] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const scope = useMemo<AiAccessScope>(() => ({ organizationId: 'demo-organization', professionalId: 'demo-professional', clinicalAccess: true, allowedPatientIds: workspace.patients.map((patient) => patient.id) }), [workspace.patients])

  useEffect(() => {
    controller.current?.abort()
    setResponse(null); setUsage(null); setDraft(''); setReviewed(false); setError(''); setFeedback('')
  }, [patientId, range.start, range.end])

  const toggleSection = (key: ClinicalSectionKey) => setSelectedSections((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const generate = async () => {
    setError(''); setFeedback(''); setReviewed(false); setRunning(true)
    const nextController = new AbortController(); controller.current = nextController
    try {
      const context = prepareAuthorizedClinicalContext(workspace, patientId, range, scope)
      const request = buildClinicalAiRequest(context, tool, selectedSections)
      const result = await runClinicalAiOperation({ provider, request, scope, ledger, signal: nextController.signal })
      setResponse(result.response); setUsage(result.usage); setDraft(responseToEditableDraft(result.response))
    } catch (reason) {
      if (nextController.signal.aborted) setFeedback('Geração cancelada. Nenhum rascunho foi aplicado.')
      else setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o rascunho simulado.')
    } finally {
      if (controller.current === nextController) controller.current = null
      setRunning(false)
    }
  }

  return <section className="panel clinical-assistant" aria-labelledby="clinical-assistant-title">
    <header className="clinical-assistant__header"><div className="clinical-assistant__title"><span className="clinical-assistant__icon"><Bot size={20} /></span><div><span className="eyebrow">Apoio generativo controlado</span><h3 id="clinical-assistant-title">Assistente clínico</h3><p>Rascunhos simulados, baseados somente nos registros autorizados deste paciente.</p></div></div><div className="clinical-processing-state"><span className="simulation-badge"><Sparkles size={13} /> Modo simulado</span><small>Integração real bloqueada</small></div></header>
    <div className="clinical-assistant__safety"><ShieldCheck size={17} /><p><strong>Revisão profissional obrigatória.</strong> O assistente não diagnostica, não prescreve e não altera o prontuário. Registros clínicos são tratados como dados, nunca como comandos.</p></div>
    <fieldset className="clinical-tool-picker"><legend>Escolha uma ferramenta</legend>{tools.map((item) => <label key={item.id} className={tool === item.id ? 'selected' : ''}><input type="radio" name="clinical-tool" value={item.id} checked={tool === item.id} onChange={() => { setTool(item.id); setResponse(null); setDraft(''); setReviewed(false) }} /><span><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</fieldset>
    <fieldset className="clinical-section-picker"><legend>Seções do rascunho</legend>{sectionKeys.map((key) => <label key={key}><input type="checkbox" checked={selectedSections.includes(key)} onChange={() => toggleSection(key)} /><span>{sectionLabels[key]}</span></label>)}</fieldset>
    <div className="clinical-assistant__actions"><button className="button button--primary" type="button" disabled={running || selectedSections.length === 0} onClick={() => void generate()}>{running ? <><LoaderCircle className="spin" size={16} /> Gerando simulação…</> : <><Sparkles size={16} /> Gerar rascunho simulado</>}</button>{running && <button className="button button--soft" type="button" onClick={() => controller.current?.abort()}><Square size={13} /> Cancelar</button>}<small>Nenhum dado é enviado a serviço externo.</small></div>
    {selectedSections.length === 0 && <p className="form-error" role="alert">Selecione ao menos uma seção.</p>}{error && <p className="form-error" role="alert">{error}</p>}{feedback && <p className="connection-feedback" role="status">{feedback}</p>}
    {response && <div className="clinical-result"><header><div><span className="eyebrow">Saída estruturada e rastreável</span><h4>Resultado da simulação</h4></div><span>{response.model}</span></header><div className="clinical-result__sections">{sectionKeys.filter((key) => response.sections[key].length > 0).map((key) => <article key={key}><h5>{sectionLabels[key]}</h5><ul>{response.sections[key].map((item, index) => <li key={`${key}-${index}`}><p>{item.text}</p>{item.sourceRefs.length > 0 && <div className="clinical-source-links"><span>Fontes:</span>{item.sourceRefs.map((ref) => { const source = responseSource(response, ref, workspace, patientId, range, scope); return <Link key={ref} to={source?.href ?? `/pacientes/${patientId}`}><ExternalLink size={11} /> {ref}</Link> })}</div>}</li>)}</ul></article>)}</div>
      <div className="clinical-draft"><header><div><PencilLine size={16} /><div><span className="eyebrow">Conteúdo não salvo</span><h4>Rascunho editável</h4></div></div>{reviewed && <span className="reviewed-badge"><Check size={12} /> Revisado · operação {response.requestId.slice(0,8)}</span>}</header><textarea aria-label="Rascunho clínico gerado e editável" rows={14} value={draft} onChange={(event) => { setDraft(event.target.value); setReviewed(false) }} /><div className="clinical-draft__actions"><button className="button button--soft" type="button" onClick={() => setReviewed(true)} disabled={!draft.trim()}><Check size={15} /> Marcar como revisado</button><button className="button button--soft" type="button" onClick={() => void navigator.clipboard.writeText(draft).then(() => setFeedback('Rascunho revisável copiado.')).catch(() => setFeedback('Não foi possível copiar neste navegador.'))} disabled={!draft.trim() || !reviewed}><ClipboardCopy size={15} /> Copiar resultado revisado</button><button className="text-button muted" type="button" onClick={() => { setResponse(null); setUsage(null); setDraft(''); setReviewed(false); setFeedback('Rascunho descartado sem alterar o prontuário.') }}><Trash2 size={14} /> Descartar</button></div></div>
      {usage && <dl className="clinical-usage" aria-label="Metadados da geração simulada"><div><dt>Modelo</dt><dd>{usage.model}</dd></div><div><dt>Entrada estimada</dt><dd>{usage.inputTokens ?? 0} tokens</dd></div><div><dt>Saída estimada</dt><dd>{usage.outputTokens ?? 0} tokens</dd></div><div><dt>Custo</dt><dd>R$ 0,00 · simulado</dd></div><div><dt>Uso demonstrativo</dt><dd>{ledger.utilization(scope.organizationId,scope.professionalId).used} de {ledger.utilization(scope.organizationId,scope.professionalId).limit}</dd></div></dl>}
    </div>}
  </section>
}

function responseSource(_response: ClinicalAiResponse, ref: string, workspace: NutritionWorkspace, patientId: string, range: DateRange, scope: AiAccessScope) {
  return prepareAuthorizedClinicalContext(workspace, patientId, range, scope).sources.find((source) => source.id === ref)
}
