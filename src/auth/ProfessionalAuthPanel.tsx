import { ArrowLeft, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Brand } from '../components/Brand'
import { useAuth } from './AuthProvider'

export function ProfessionalAuthPanel() {
  const { state, signIn, requestPasswordReset, verifyMfa } = useAuth()
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true); setFeedback('')
    await signIn(String(data.get('email') ?? ''), String(data.get('password') ?? ''))
    setBusy(false)
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true); setFeedback('')
    try {
      await requestPasswordReset(String(data.get('email') ?? ''))
      setFeedback('Se o endereço estiver cadastrado, enviaremos as instruções de recuperação.')
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Não foi possível solicitar a recuperação.')
    } finally { setBusy(false) }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true); setFeedback('')
    try { await verifyMfa(String(data.get('code') ?? '')) }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : 'Código inválido.') }
    finally { setBusy(false) }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel"><Brand /><div><span>ACESSO PROFISSIONAL</span><h1>Cuidado nutricional com contexto e continuidade.</h1><p>Um ambiente protegido para organizar avaliações, planos e evolução de cada paciente.</p></div><small>Dados de saúde exigem acesso individual e verificável.</small></section>
      <section className="auth-form-panel">
        <div className="auth-card">
          {state.status === 'loading' ? <div className="auth-loading"><LoaderCircle className="spin" /><strong>Verificando sua sessão…</strong><span>Isso pode levar alguns segundos.</span></div> : state.status === 'mfa-required' ? <>
            <span className="auth-icon"><ShieldCheck /></span><span className="eyebrow">Segunda etapa</span><h2>Confirme sua identidade</h2><p>Digite o código de seis dígitos do seu aplicativo autenticador.</p>
            <form onSubmit={submitMfa} className="form-stack"><label className="field"><span>Código de verificação</span><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label>{feedback && <p className="form-error" role="alert">{feedback}</p>}<button className="button button--primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <ShieldCheck />}Verificar e continuar</button></form>
          </> : mode === 'forgot' ? <>
            <button className="auth-back" type="button" onClick={() => { setMode('login'); setFeedback('') }}><ArrowLeft size={15} /> Voltar</button><span className="auth-icon"><KeyRound /></span><span className="eyebrow">Recuperação segura</span><h2>Redefina sua senha</h2><p>Informe o e-mail profissional associado à sua conta.</p>
            <form onSubmit={submitRecovery} className="form-stack"><label className="field"><span>E-mail profissional</span><div className="auth-input"><Mail size={16} /><input type="email" name="email" autoComplete="email" required /></div></label>{feedback && <p className="auth-feedback" role="status">{feedback}</p>}<button className="button button--primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Mail />}Enviar instruções</button></form>
          </> : <>
            <span className="auth-icon"><LockKeyhole /></span><span className="eyebrow">Bem-vindo de volta</span><h2>Acesse o AtriaNutri</h2><p>Use seu e-mail profissional e sua senha.</p>
            <form onSubmit={submitLogin} className="form-stack"><label className="field"><span>E-mail profissional</span><div className="auth-input"><Mail size={16} /><input type="email" name="email" autoComplete="username" required /></div></label><label className="field"><span>Senha</span><div className="auth-input"><LockKeyhole size={16} /><input type="password" name="password" autoComplete="current-password" required /></div></label>{state.message && <p className="form-error" role="alert">{state.message}</p>}<button className="auth-forgot" type="button" onClick={() => setMode('forgot')}>Esqueci minha senha</button><button className="button button--primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <LockKeyhole />}Entrar com segurança</button></form>
          </>}
        </div>
      </section>
    </main>
  )
}
