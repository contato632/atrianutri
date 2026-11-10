import { CheckCircle2, KeyRound, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type { MfaEnrollment } from '../auth/types'

export function SecurityPage() {
  const { state, enrollTotp, verifyTotpEnrollment, updatePassword, signOut } = useAuth()
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  if (state.status !== 'signed-in') return null

  async function beginEnrollment() {
    setBusy(true); setFeedback('')
    try { setEnrollment(await enrollTotp()) }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : 'Não foi possível iniciar o MFA.') }
    finally { setBusy(false) }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enrollment) return
    setBusy(true); setFeedback('')
    try {
      const data = new FormData(event.currentTarget)
      await verifyTotpEnrollment(enrollment.factorId, String(data.get('code') ?? ''))
      setEnrollment(null); setFeedback('Autenticação em duas etapas confirmada.')
    } catch (reason) { setFeedback(reason instanceof Error ? reason.message : 'Código inválido.') }
    finally { setBusy(false) }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    const confirmation = String(data.get('confirmation') ?? '')
    if (password !== confirmation) { setFeedback('As senhas não coincidem.'); return }
    setBusy(true); setFeedback('')
    try { await updatePassword(password); setFeedback('Senha atualizada com segurança.') }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : 'Não foi possível atualizar a senha.') }
    finally { setBusy(false) }
  }

  return <div className="page-stack">
    <section className="section-intro"><div><h2>Segurança da conta</h2><p>Gerencie sua senha, autenticador e sessão profissional.</p></div><button className="button button--soft" type="button" onClick={() => void signOut()}><LogOut size={16} /> Encerrar sessão</button></section>
    {feedback && <div className="security-feedback" role="status"><CheckCircle2 size={17} />{feedback}</div>}
    <div className="security-grid">
      <section className="panel security-card"><span className="auth-icon"><ShieldCheck /></span><div><span className="eyebrow">MFA / TOTP</span><h3>Aplicativo autenticador</h3><p>Adicione uma segunda etapa individual à sua conta profissional.</p></div>
        {!enrollment ? <button className="button button--primary" type="button" onClick={() => void beginEnrollment()} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <ShieldCheck size={16} />}Configurar autenticador</button> : <form className="form-stack" onSubmit={verifyEnrollment}><img className="totp-qr" src={enrollment.qrCode} alt="QR code para configurar o aplicativo autenticador" /><p className="totp-secret">Chave manual: <code>{enrollment.secret}</code></p><label className="field"><span>Código de seis dígitos</span><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label><button className="button button--primary" disabled={busy}>Confirmar autenticador</button></form>}
      </section>
      <section className="panel security-card"><span className="auth-icon"><KeyRound /></span><div><span className="eyebrow">Credencial</span><h3>Alterar senha</h3><p>A sessão será revalidada pelo Supabase Auth.</p></div><form className="form-stack" onSubmit={changePassword}><label className="field"><span>Nova senha</span><input type="password" name="password" autoComplete="new-password" minLength={12} required /></label><label className="field"><span>Confirmar senha</span><input type="password" name="confirmation" autoComplete="new-password" minLength={12} required /></label><button className="button button--soft" disabled={busy}><KeyRound size={16} />Atualizar senha</button></form></section>
    </div>
  </div>
}
