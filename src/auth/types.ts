export type ProfessionalMembership = {
  organizationId: string
  role: 'owner' | 'admin' | 'nutritionist' | 'reception'
  clinicalAccess: boolean
}

export type ProfessionalIdentity = {
  userId: string
  email: string
  memberships: ProfessionalMembership[]
  requiresMfa: boolean
}

export type MfaEnrollment = {
  factorId: string
  qrCode: string
  secret: string
  uri: string
}

export interface ProfessionalAuthService {
  restoreSession(): Promise<ProfessionalIdentity | null>
  signIn(email: string, password: string): Promise<ProfessionalIdentity>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  enrollTotp(friendlyName?: string): Promise<MfaEnrollment>
  verifyTotp(factorId: string, code: string): Promise<ProfessionalIdentity>
  verifyExistingTotp(code: string): Promise<ProfessionalIdentity>
  signOut(): Promise<void>
  onAuthEvent(callback: (event: string) => void): () => void
}

export type AuthViewState =
  | { status: 'loading'; identity: null; message: null }
  | { status: 'signed-out'; identity: null; message: string | null }
  | { status: 'mfa-required'; identity: ProfessionalIdentity; message: null }
  | { status: 'signed-in'; identity: ProfessionalIdentity; message: null }
  | { status: 'session-expired'; identity: null; message: string }
  | { status: 'error'; identity: null; message: string }
