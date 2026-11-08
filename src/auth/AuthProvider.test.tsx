import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'
import type { ProfessionalAuthService, ProfessionalIdentity } from './types'

const mfaIdentity: ProfessionalIdentity = {
  userId: 'user-1', email: 'nutri@demo.local', requiresMfa: true,
  memberships: [{ organizationId: 'org-1', role: 'nutritionist', clinicalAccess: true }],
}
const verifiedIdentity: ProfessionalIdentity = { ...mfaIdentity, requiresMfa: false }

function Probe() {
  const { state, signIn, verifyMfa, signOut } = useAuth()
  return <div><span data-testid="status">{state.status}</span><button onClick={() => void signIn('nutri@demo.local', 'senha-segura')}>Entrar</button><button onClick={() => void verifyMfa('123456')}>MFA</button><button onClick={() => void signOut()}>Sair</button></div>
}

function service(overrides: Partial<ProfessionalAuthService> = {}): ProfessionalAuthService {
  return {
    restoreSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(mfaIdentity),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    enrollTotp: vi.fn(),
    verifyTotp: vi.fn(),
    verifyExistingTotp: vi.fn().mockResolvedValue(verifiedIdentity),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthEvent: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  }
}

describe('AuthProvider', () => {
  it('restaura sessão, exige MFA e só libera após verificação', async () => {
    const user = userEvent.setup()
    const auth = service()
    render(<AuthProvider service={auth}><Probe /></AuthProvider>)
    expect(await screen.findByText('signed-out')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('mfa-required')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'MFA' }))
    expect(await screen.findByText('signed-in')).toBeInTheDocument()
    expect(auth.verifyExistingTotp).toHaveBeenCalledWith('123456')

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByText('signed-out')).toBeInTheDocument()
  })

  it('distingue sessão expirada de falha genérica', async () => {
    const auth = service({ restoreSession: vi.fn().mockRejectedValue(new Error('Sua sessão expirou. Entre novamente.')) })
    render(<AuthProvider service={auth}><Probe /></AuthProvider>)
    expect(await screen.findByText('session-expired')).toBeInTheDocument()
  })
})
