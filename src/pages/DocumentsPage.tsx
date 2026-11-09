import { Download, FileBarChart, FileText, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { buildNutritionDocument, defaultDocumentOptions, documentDefinitions, type NutritionDocumentOptions, type NutritionDocumentType } from '../domain/documents'
import { nutritionPdfBlob } from '../lib/nutritionPdf'
import { useWorkspace } from '../state/WorkspaceContext'

export function DocumentsPage({ authorized = true }: { authorized?: boolean }) {
  const { workspace, loading } = useWorkspace()
  const firstPatient = workspace.nutritionEvaluations[0]?.patientId ?? workspace.assessments[0]?.patientId ?? workspace.patients[0]?.id ?? ''
  const [type, setType] = useState<NutritionDocumentType>('evaluation')
  const [patientId, setPatientId] = useState(firstPatient)
  const [options, setOptions] = useState<NutritionDocumentOptions>(() => defaultDocumentOptions('evaluation', firstPatient))
  const [preview, setPreview] = useState<{ url: string; fileName: string; key: string } | null>(null)
  const [error, setError] = useState('')
  const optionsKey = JSON.stringify(options)

  useEffect(() => {
    if (!patientId && firstPatient) { setPatientId(firstPatient); setOptions((current) => ({ ...current, patientId: firstPatient })) }
  }, [firstPatient, patientId])

  useEffect(() => {
    if (!options.branding.professionalName && workspace.nutritionEvaluations.length) {
      setOptions((current) => ({ ...current, branding: { ...current.branding, professionalName: workspace.nutritionEvaluations[0].authorLabel } }))
    }
  }, [options.branding.professionalName, workspace.nutritionEvaluations])

  const evaluations = useMemo(() => workspace.nutritionEvaluations.filter((item) => item.patientId === patientId).sort((a, b) => b.evaluatedOn.localeCompare(a.evaluatedOn)), [patientId, workspace.nutritionEvaluations])
  const plans = useMemo(() => workspace.mealPlans.filter((item) => item.patientId === patientId), [patientId, workspace.mealPlans])
  const selectedPlan = plans.find((item) => item.id === options.planId) ?? plans[0]
  const availableVersions = selectedPlan ? Array.from(new Set([selectedPlan.version, ...selectedPlan.revisions.filter((item) => item.meals).map((item) => item.version)])).sort((a, b) => b - a) : []

  useEffect(() => {
    if (type === 'evaluation' && evaluations.length && !evaluations.some((item) => item.id === options.evaluationId)) setOptions((current) => ({ ...current, evaluationId: evaluations[0].id }))
    if (type === 'meal-plan' && selectedPlan && options.planId !== selectedPlan.id) setOptions((current) => ({ ...current, planId: selectedPlan.id, planVersion: selectedPlan.version }))
  }, [evaluations, options.evaluationId, options.planId, selectedPlan, type])

  function changeType(nextType: NutritionDocumentType) {
    const professionalName = options.branding.professionalName
    const next = defaultDocumentOptions(nextType, patientId, professionalName)
    next.branding = { ...next.branding, ...options.branding }
    const patientEvaluations = workspace.nutritionEvaluations.filter((item) => item.patientId === patientId).sort((a, b) => b.evaluatedOn.localeCompare(a.evaluatedOn))
    const patientPlans = workspace.mealPlans.filter((item) => item.patientId === patientId)
    next.evaluationId = patientEvaluations[0]?.id
    next.planId = patientPlans[0]?.id
    next.planVersion = patientPlans[0]?.version
    setType(nextType); setOptions(next); setError('')
  }

  function changePatient(nextPatient: string) {
    const patientEvaluations = workspace.nutritionEvaluations.filter((item) => item.patientId === nextPatient).sort((a, b) => b.evaluatedOn.localeCompare(a.evaluatedOn))
    const patientPlans = workspace.mealPlans.filter((item) => item.patientId === nextPatient)
    setPatientId(nextPatient)
    setOptions((current) => ({ ...current, patientId: nextPatient, evaluationId: patientEvaluations[0]?.id, planId: patientPlans[0]?.id, planVersion: patientPlans[0]?.version }))
    setError('')
  }

  function generatePreview() {
    try {
      const document = buildNutritionDocument(workspace, options)
      const url = URL.createObjectURL(nutritionPdfBlob(document))
      setPreview((current) => { if (current) URL.revokeObjectURL(current.url); return { url, fileName: document.fileName, key: optionsKey } })
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o documento.') }
  }

  function download() {
    if (!preview || preview.key !== optionsKey) { setError('Atualize a prévia antes de baixar para garantir que o PDF corresponda ao conteúdo revisado.'); return }
    const anchor = document.createElement('a'); anchor.href = preview.url; anchor.download = preview.fileName; anchor.click(); setError('')
  }

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  if (!authorized) return <section className="panel document-denied"><LockKeyhole size={28} /><span className="eyebrow">Acesso clínico necessário</span><h2>Central de documentos restrita</h2><p>Somente profissionais com acesso clínico ativo na organização podem visualizar ou gerar relatórios nutricionais.</p></section>
  if (loading) return <div className="skeleton-list"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
  const definition = documentDefinitions[type]

  return <div className="page-stack documents-page">
    <section className="section-intro"><div><h2>Central de documentos</h2><p>Prepare relatórios profissionais em PDF usando somente os registros existentes.</p></div><span className="local-pdf-chip"><ShieldCheck size={15} /> Geração local e protegida</span></section>

    <section className="document-types" aria-label="Tipos de documento">{(Object.entries(documentDefinitions) as [NutritionDocumentType, typeof definition][]).map(([key, item]) => <button type="button" className={type === key ? 'active' : ''} onClick={() => changeType(key)} key={key}><span>{key === 'evolution' ? <FileBarChart size={18} /> : <FileText size={18} />}</span><strong>{item.label}</strong><small>{item.description}</small></button>)}</section>

    <div className="document-workspace">
      <aside className="panel document-editor">
        <header><span className="eyebrow">Editor do conteúdo</span><h3>{definition.label}</h3></header>
        <label className="field"><span>Paciente</span><select value={patientId} onChange={(event) => changePatient(event.target.value)} aria-label="Paciente do documento">{workspace.patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.fullName}</option>)}</select></label>
        {type === 'evaluation' && <label className="field"><span>Avaliação registrada</span><select value={options.evaluationId ?? ''} onChange={(event) => setOptions((current) => ({ ...current, evaluationId: event.target.value }))}>{evaluations.length ? evaluations.map((evaluation) => <option value={evaluation.id} key={evaluation.id}>{evaluation.evaluatedOn} · {evaluation.authorLabel}</option>) : <option value="">Nenhuma avaliação disponível</option>}</select></label>}
        {type === 'meal-plan' && <div className="field-grid field-grid--2"><label className="field"><span>Plano alimentar</span><select value={selectedPlan?.id ?? ''} onChange={(event) => { const plan = plans.find((item) => item.id === event.target.value); setOptions((current) => ({ ...current, planId: event.target.value, planVersion: plan?.version })) }}>{plans.length ? plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.title}</option>) : <option value="">Nenhum plano disponível</option>}</select></label><label className="field"><span>Versão do plano</span><select value={options.planVersion ?? ''} onChange={(event) => setOptions((current) => ({ ...current, planVersion: Number(event.target.value) }))}>{availableVersions.map((version) => <option value={version} key={version}>Versão {version}</option>)}</select></label></div>}

        <label className="field"><span>Título do documento</span><input value={options.title} onChange={(event) => setOptions((current) => ({ ...current, title: event.target.value }))} maxLength={160} /></label>
        <label className="field"><span>Texto de abertura <small>opcional</small></span><textarea value={options.introduction} onChange={(event) => setOptions((current) => ({ ...current, introduction: event.target.value }))} rows={3} maxLength={2000} /></label>

        <fieldset className="document-sections"><legend>Seções do documento</legend>{definition.sections.map((section) => <label className={section.restricted ? 'restricted' : ''} key={section.id}><input type="checkbox" checked={options.sections.includes(section.id)} onChange={(event) => setOptions((current) => ({ ...current, sections: event.target.checked ? [...current.sections, section.id] : current.sections.filter((item) => item !== section.id) }))} /><span>{section.label}{section.restricted && <small><LockKeyhole size={11} /> Conteúdo clínico restrito</small>}</span></label>)}</fieldset>

        <details className="document-branding" open><summary>Cabeçalho e identificação profissional</summary><div className="document-branding__fields"><label className="field"><span>Nome da clínica</span><input value={options.branding.clinicName} onChange={(event) => setOptions((current) => ({ ...current, branding: { ...current.branding, clinicName: event.target.value } }))} /></label><label className="field"><span>Nutricionista</span><input value={options.branding.professionalName} onChange={(event) => setOptions((current) => ({ ...current, branding: { ...current.branding, professionalName: event.target.value } }))} /></label><label className="field"><span>CRN</span><input value={options.branding.crn} onChange={(event) => setOptions((current) => ({ ...current, branding: { ...current.branding, crn: event.target.value } }))} placeholder="Informe o registro profissional" /></label><label className="field"><span>Cor principal</span><input type="color" value={options.branding.primaryColor} onChange={(event) => setOptions((current) => ({ ...current, branding: { ...current.branding, primaryColor: event.target.value } }))} /></label><label className="field document-wide"><span>Complemento do cabeçalho <small>opcional</small></span><input value={options.branding.headerText} onChange={(event) => setOptions((current) => ({ ...current, branding: { ...current.branding, headerText: event.target.value } }))} /></label><label className="field document-wide"><span>Rodapé</span><input value={options.branding.footerText} onChange={(event) => setOptions((current) => ({ ...current, branding: { ...current.branding, footerText: event.target.value } }))} /></label></div></details>
        <label className="field"><span>Observações finais <small>opcional</small></span><textarea value={options.closingNotes} onChange={(event) => setOptions((current) => ({ ...current, closingNotes: event.target.value }))} rows={3} maxLength={2000} /></label>
        <p className="document-safety"><LockKeyhole size={14} /> Notas privadas do diário, metas e anamnese não são incluídas. Nenhuma assinatura, diagnóstico ou recomendação é criada automaticamente.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="document-actions"><button type="button" className="button button--soft" onClick={generatePreview}><RefreshCw size={15} /> Atualizar prévia</button><button type="button" className="button button--primary" onClick={download} disabled={!preview || preview.key !== optionsKey}><Download size={15} /> Baixar PDF</button></div>
      </aside>

      <section className="panel document-preview"><header><div><span className="eyebrow">Pré-visualização fiel</span><h3>Página A4 final</h3></div><small>{preview && preview.key !== optionsKey ? 'Prévia desatualizada — atualize antes do download.' : 'O arquivo exibido é o mesmo PDF disponível para download.'}</small></header>{preview ? <iframe title="Pré-visualização do PDF" src={preview.url} /> : <div className="document-preview__empty"><FileText size={32} /><strong>Prévia ainda não gerada</strong><p>Informe o CRN, revise as seções e atualize a prévia.</p></div>}</section>
    </div>
  </div>
}
