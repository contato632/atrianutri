import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthViewState, MfaEnrollment, ProfessionalAuthService } from './types'

type AuthContextValue = {
  state: AuthViewState
  signIn: (email: string, password: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  verifyMfa: (code: string) => Promise<void>
  enrollTotp: () => Promise<MfaEnrollment>
  verifyTotpEnrollment: (factorId: string, code: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const initialState: AuthViewState = { status: 'loading', identity: null, message: null }

export function AuthProvider({ service, children }: { service: ProfessionalAuthService; children: ReactNode }) {
  const [state, setState] = useState<AuthViewState>(initialState)

  const refresh = useCallback(async () => {
    setState(initialState)
    try {
      const identity = await service.restoreSession()
      if (!identity) setState({ status: 'signed-out', identity: null, message: null })
      else if (identity.requiresMfa) setState({ status: 'mfa-required', identity, message: null })
      else setState({ status: 'signed-in', identity, message: null })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Sua sessão não pôde ser restaurada.'
      setState({ status: /expir/i.test(message) ? 'session-expired' : 'error', identity: null, message })
    }
  }, [service])

  useEffect(() => {
    void refresh()
    return service.onAuthEvent((event) => {
      if (event === 'SIGNED_OUT') setState({ status: 'signed-out', identity: null, message: null })
      else if (event === 'PASSWORD_RECOVERY') queueMicrotask(async () => {
        try {
          const identity = await service.restoreSession()
          setState(identity ? { status: 'password-recovery', identity, message: null } : { status: 'signed-out', identity: null, message: null })
        } catch (reason) {
          setState({ status: 'error', identity: null, message: reason instanceof Error ? reason.message : 'Não foi possível validar a recuperação.' })
        }
      })
      else queueMicrotask(() => { void refresh() })
    })
  }, [refresh, service])

  const value = useMemo<AuthContextValue>(() => ({
    state,
    refresh,
    async signIn(email, password) {
      setState(initialState)
      try {
        const identity = await service.signIn(email, password)
        setState(identity.requiresMfa ? { status: 'mfa-required', identity, message: null } : { status: 'signed-in', identity, message: null })
      } catch (reason) {
        setState({ status: 'signed-out', identity: null, message: reason instanceof Error ? reason.message : 'Não foi possível entrar.' })
      }
    },
    async requestPasswordReset(email) { await service.requestPasswordReset(email) },
    async verifyMfa(code) {
      try {
        const identity = await service.verifyExistingTotp(code)
        setState({ status: 'signed-in', identity, message: null })
      } catch (reason) {
        setState((current) => current.status === 'mfa-required' ? current : { status: 'error', identity: null, message: reason instanceof Error ? reason.message : 'Código inválido.' })
        throw reason
      }
    },
    async enrollTotp() { return service.enrollTotp() },
    async verifyTotpEnrollment(factorId, code) {
      const identity = await service.verifyTotp(factorId, code)
      setState({ status: 'signed-in', identity, message: null })
    },
    async updatePassword(password) {
      await service.updatePassword(password)
      const identity = await service.restoreSession()
      if (!identity) throw new Error('Sua sessão expirou. Entre novamente.')
      setState({ status: 'signed-in', identity, message: null })
    },
    async signOut() {
      await service.signOut()
      setState({ status: 'signed-out', identity: null, message: null })
    },
  }), [refresh, service, state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return value
}
