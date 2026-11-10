import type { SupabaseClient } from '@supabase/supabase-js'
import type { MfaEnrollment, ProfessionalAuthService, ProfessionalIdentity, ProfessionalMembership } from './types'

const genericAuthError = 'Não foi possível concluir a autenticação. Revise os dados e tente novamente.'

function authError(error: unknown, fallback = genericAuthError) {
  if (!(error instanceof Error)) return new Error(fallback)
  if (/invalid login credentials/i.test(error.message)) return new Error('E-mail ou senha incorretos.')
  if (/session.*missing|refresh token/i.test(error.message)) return new Error('Sua sessão expirou. Entre novamente.')
  if (/factor|challenge|totp|code/i.test(error.message)) return new Error('Código de verificação inválido ou expirado.')
  return new Error(fallback)
}

export class SupabaseProfessionalAuthService implements ProfessionalAuthService {
  constructor(private readonly client: SupabaseClient) {}

  private async verifiedIdentity(): Promise<ProfessionalIdentity> {
    const { data: userData, error: userError } = await this.client.auth.getUser()
    if (userError || !userData.user) throw authError(userError, 'Sua sessão não pôde ser verificada.')
    const verifiedUser = userData.user

    const { data: rows, error: membershipError } = await this.client
      .from('organization_members')
      .select('organization_id,role,clinical_access,organizations!organization_members_organization_id_fkey(name)')
      .eq('user_id', verifiedUser.id)
      .eq('active', true)

    if (membershipError) {
      await this.client.auth.signOut({ scope: 'local' })
      throw new Error('Não foi possível verificar seu vínculo profissional.')
    }
    if (!rows?.length) {
      await this.client.auth.signOut({ scope: 'local' })
      throw new Error('Esta conta não possui um vínculo profissional ativo.')
    }

    const memberships: ProfessionalMembership[] = rows.map((row) => {
      const organization = row.organizations as unknown as { name?: string } | { name?: string }[] | null
      const organizationName = Array.isArray(organization) ? organization[0]?.name : organization?.name
      return {
        organizationId: String(row.organization_id),
        organizationName: String(organizationName ?? 'Organização'),
        role: row.role as ProfessionalMembership['role'],
        clinicalAccess: Boolean(row.clinical_access),
      }
    })
    const { data: assurance, error: assuranceError } = await this.client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError) throw authError(assuranceError, 'Não foi possível verificar a autenticação em duas etapas.')

    return {
      userId: verifiedUser.id,
      email: verifiedUser.email ?? '',
      memberships,
      requiresMfa: assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2',
    }
  }

  async restoreSession() {
    const { data: sessionData, error: sessionError } = await this.client.auth.getSession()
    if (sessionError) throw authError(sessionError)
    if (!sessionData.session) return null
    return this.verifiedIdentity()
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error || !data.user) throw authError(error)
    return this.verifiedIdentity()
  }

  async requestPasswordReset(email: string) {
    const redirectTo = new URL('/recuperar-senha', window.location.origin).toString()
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
    if (error) throw authError(error, 'Não foi possível enviar as instruções de recuperação.')
  }

  async updatePassword(password: string) {
    if (password.length < 12) throw new Error('Use uma senha com pelo menos 12 caracteres.')
    const { error } = await this.client.auth.updateUser({ password })
    if (error) throw authError(error, 'Não foi possível atualizar a senha.')
  }

  async enrollTotp(friendlyName = 'AtriaNutri') {
    const { data, error } = await this.client.auth.mfa.enroll({ factorType: 'totp', friendlyName })
    if (error || !data?.totp) throw authError(error, 'Não foi possível iniciar a autenticação em duas etapas.')
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    } satisfies MfaEnrollment
  }

  async verifyTotp(factorId: string, code: string) {
    const { error } = await this.client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    if (error) throw authError(error)
    return this.verifiedIdentity()
  }

  async verifyExistingTotp(code: string) {
    const { data, error } = await this.client.auth.mfa.listFactors()
    if (error) throw authError(error)
    const factor = data.totp.find((item) => item.status === 'verified')
    if (!factor) throw new Error('Nenhum autenticador verificado foi encontrado para esta conta.')
    return this.verifyTotp(factor.id, code)
  }

  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: 'local' })
    if (error) throw authError(error, 'Não foi possível encerrar a sessão com segurança.')
  }

  onAuthEvent(callback: (event: string) => void) {
    const { data } = this.client.auth.onAuthStateChange((event) => callback(event))
    return () => data.subscription.unsubscribe()
  }
}
