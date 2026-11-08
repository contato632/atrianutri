import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'
import type { ProfessionalAuthService, ProfessionalIdentity } from './types'

const mfaIdentity: ProfessionalIdentity = {
  userId: 'user-1', email: 'nutri@demo.local', requiresMfa: true,
  memberships: [{ organizationId: 'org-1', organizationName: 'Clínica fictícia', role: 'nutritionist', clinicalAccess: true }],
}
const verifiedIdentity: ProfessionalIdentity = { ...mfaIdentity, requiresMfa: false }

function Probe() {
  const { state, signIn, verifyMfa, signOut, updatePassword, enrollTotp, verifyTotpEnrollment } = useAuth()
  return <div><span data-testid="status">{state.status}</span><button onClick={() => void signIn('nutri@demo.local', 'senha-segura')}>Entrar</button><button onClick={() => void verifyMfa('123456')}>MFA</button><button onClick={() => void updatePassword('Nova-senha-segura-123')}>Atualizar senha</button><button onClick={() => void enrollTotp().then((factor) => verifyTotpEnrollment(factor.factorId, '123456'))}>Configurar MFA</button><button onClick={() => void signOut()}>Sair</button></div>
}

function service(overrides: Partial<ProfessionalAuthService> = {}): ProfessionalAuthService {
  return {
    restoreSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(mfaIdentity),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    enrollTotp: vi.fn().mockResolvedValue({ factorId: 'factor-1', qrCode: 'data:image/svg+xml,test', secret: 'SECRET', uri: 'otpauth://test' }),
    verifyTotp: vi.fn().mockResolvedValue(verifiedIdentity),
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

  it('trata recuperação de senha e enrollment TOTP dentro da sessão verificada', async () => {
    const user = userEvent.setup()
    let emit: ((event: string) => void) | undefined
    const auth = service({
      restoreSession: vi.fn().mockResolvedValue(verifiedIdentity),
      onAuthEvent: vi.fn().mockImplementation((callback) => { emit = callback; return () => undefined }),
    })
    render(<AuthProvider service={auth}><Probe /></AuthProvider>)
    expect(await screen.findByText('signed-in')).toBeInTheDocument()

    act(() => emit?.('PASSWORD_RECOVERY'))
    expect(await screen.findByText('password-recovery')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Atualizar senha' }))
    expect(await screen.findByText('signed-in')).toBeInTheDocument()
    expect(auth.updatePassword).toHaveBeenCalledWith('Nova-senha-segura-123')

    await user.click(screen.getByRole('button', { name: 'Configurar MFA' }))
    expect(auth.verifyTotp).toHaveBeenCalledWith('factor-1', '123456')
  })
})
