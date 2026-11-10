import { Check, Settings2, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { isValidCrn, type DocumentBranding } from '../domain/documents'
import { useDocumentPreferences } from '../state/DocumentPreferencesContext'

export function ProfessionalDocumentSettings() {
  const { branding, loading, saved, save } = useDocumentPreferences()
  const [draft, setDraft] = useState(branding)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => { setDraft(branding) }, [branding])
  const update = <Key extends keyof DocumentBranding>(key: Key, value: DocumentBranding[Key]) => setDraft((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setConfirmation('')
    if (!draft.professionalName.trim()) { setError('Informe o nome profissional.'); return }
    if (!isValidCrn(draft.crn)) { setError('Informe um CRN válido no formato CRN-5 12345.'); return }
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) { setError('Informe um e-mail profissional válido.'); return }
    await save({ ...draft, clinicName: draft.clinicName.trim(), professionalName: draft.professionalName.trim(), crn: draft.crn.trim().toUpperCase(), phone: draft.phone.trim(), email: draft.email.trim(), address: draft.address.trim(), headerText: draft.headerText.trim(), footerText: draft.footerText.trim() })
    setConfirmation('Preferências salvas para esta sessão.')
  }

  if (loading) return <section className="panel professional-settings professional-settings--loading"><span className="skeleton" /></section>
  const contacts = draft.showContacts ? [draft.phone, draft.email, draft.address].filter(Boolean).join(' · ') : ''

  return <details className="panel professional-settings">
    <summary><span><Settings2 size={18} /><span><strong>Identidade profissional dos documentos</strong><small>{saved ? 'Preferências temporárias ativas nesta sessão' : 'Configure uma vez para reutilizar nos quatro documentos'}</small></span></span><span className="professional-settings__status">{saved && <><Check size={14} /> Configurada</>}</span></summary>
    <div className="professional-settings__content">
      <form className="professional-settings__form" onSubmit={submit}>
        <div className="field-grid field-grid--2"><label className="field"><span>Nome profissional</span><input value={draft.professionalName} onChange={(event) => update('professionalName', event.target.value)} maxLength={120} required /></label><label className="field"><span>CRN</span><input value={draft.crn} onChange={(event) => update('crn', event.target.value)} placeholder="CRN-5 12345" maxLength={30} required /></label></div>
        <label className="field"><span>Clínica ou consultório</span><input value={draft.clinicName} onChange={(event) => update('clinicName', event.target.value)} maxLength={120} /></label>
        <div className="field-grid field-grid--2"><label className="field"><span>Telefone profissional</span><input value={draft.phone} onChange={(event) => update('phone', event.target.value)} inputMode="tel" maxLength={40} /></label><label className="field"><span>E-mail profissional</span><input value={draft.email} onChange={(event) => update('email', event.target.value)} type="email" maxLength={160} /></label></div>
        <label className="field"><span>Endereço <small>opcional</small></span><input value={draft.address} onChange={(event) => update('address', event.target.value)} maxLength={220} /></label>
        <div className="field-grid field-grid--2"><label className="field"><span>Cor principal</span><input type="color" value={draft.primaryColor} onChange={(event) => update('primaryColor', event.target.value)} /></label><label className="field"><span>Complemento do cabeçalho</span><input value={draft.headerText} onChange={(event) => update('headerText', event.target.value)} maxLength={160} /></label></div>
        <label className="field"><span>Rodapé personalizado</span><input value={draft.footerText} onChange={(event) => update('footerText', event.target.value)} maxLength={120} /></label>
        <label className="professional-settings__toggle"><input type="checkbox" checked={draft.showContacts} onChange={(event) => update('showContacts', event.target.checked)} /><span>Exibir contatos profissionais no cabeçalho</span></label>
        <p className="professional-settings__notice"><ShieldCheck size={15} /> No modo demonstração, estas preferências ficam apenas na memória desta sessão. Nenhum dado é gravado no navegador ou enviado a serviço externo.</p>
        {error && <p className="form-error" role="alert">{error}</p>}{confirmation && <p className="form-success" role="status">{confirmation}</p>}
        <div className="form-actions"><button className="button button--primary" type="submit">Salvar preferências da sessão</button></div>
      </form>
      <section className="identity-preview" aria-label="Pré-visualização da identidade em página A4" style={{ '--identity-color': draft.primaryColor } as CSSProperties}>
        <span className="eyebrow">Prévia da identidade · A4</span><div className="identity-preview__page"><div className="identity-preview__accent" /><header><strong>{draft.clinicName || 'Clínica ou consultório'}</strong><span>{draft.headerText || 'Complemento do cabeçalho'}</span>{contacts && <small>{contacts}</small>}</header><main><h4>Documento nutricional</h4><p>Conteúdo clínico registrado</p><div /><div /><div className="short" /></main><footer><span>{draft.footerText || 'Rodapé personalizado'}</span><strong>{draft.professionalName || 'Nome profissional'} · {draft.crn || 'CRN'}</strong><small>Página 1 de 1</small></footer></div>
      </section>
    </div>
  </details>
}
