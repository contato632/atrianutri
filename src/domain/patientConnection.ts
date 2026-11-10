import type { MealPlan, MealPlanPublication, PatientInvitation, PatientProfessionalLink } from './models'

export const INVITATION_TTL_MS = 72 * 60 * 60 * 1000

export function invitationState(invitation: PatientInvitation, now = new Date()): PatientInvitation['status'] {
  if (invitation.status === 'pending' && new Date(invitation.expiresAt).getTime() <= now.getTime()) return 'expired'
  return invitation.status
}

export function canReplaceInvitation(invitation: PatientInvitation, now = new Date()) {
  return ['expired', 'canceled'].includes(invitationState(invitation, now))
}

export function invitationMessage(invitationUrl: string) {
  return `Olá! Você recebeu um convite individual para acessar o AtriaNutri, plataforma de acompanhamento nutricional da AtriaCare. O convite não contém informações clínicas e expira por segurança. Acesse: ${invitationUrl}`
}

export function activePatientLink(links: PatientProfessionalLink[], organizationId: string, patientId: string) {
  return links.find((link) => link.organizationId === organizationId && link.patientId === patientId && link.status === 'active')
}

export function publishedPlanVersion(plans: MealPlan[], publications: MealPlanPublication[], organizationId: string, patientId: string) {
  const publication = publications.filter((item) => item.organizationId === organizationId && item.patientId === patientId && item.status === 'active').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
  if (!publication) return undefined
  const plan = plans.find((item) => item.id === publication.mealPlanId && item.patientId === patientId)
  const revision = plan?.revisions.find((item) => item.version === publication.version)
  if (!plan || !revision?.meals) return undefined
  return { ...structuredClone(plan), status: 'active' as const, version: revision.version, updatedAt: revision.savedAt, meals: structuredClone(revision.meals), nutritionTargets: structuredClone(revision.nutritionTargets ?? {}) }
}

export function connectionIndicators(input: { invitations: PatientInvitation[]; links: PatientProfessionalLink[]; publications: MealPlanPublication[]; patientId: string; organizationId: string }) {
  const pendingInvitation = input.invitations.some((item) => item.patientId === input.patientId && item.organizationId === input.organizationId && invitationState(item) === 'pending')
  const linked = Boolean(activePatientLink(input.links, input.organizationId, input.patientId))
  const planPublished = input.publications.some((item) => item.patientId === input.patientId && item.organizationId === input.organizationId && item.status === 'active')
  return { pendingInvitation, linked, planPublished }
}
