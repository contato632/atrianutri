import { describe, expect, it } from 'vitest'
import type { MealPlan, MealPlanPublication, PatientInvitation } from './models'
import { canReplaceInvitation, invitationMessage, invitationState, publishedPlanVersion } from './patientConnection'

const invitation: PatientInvitation = { id: 'invite', organizationId: 'org', patientId: 'patient', professionalId: 'professional', email: 'patient@example.test', status: 'pending', createdAt: '2026-11-10T10:00:00Z', expiresAt: '2026-11-13T10:00:00Z' }

describe('vínculo profissional-paciente', () => {
  it('expira e permite substituir somente convite encerrado', () => {
    expect(invitationState(invitation, new Date('2026-11-11T10:00:00Z'))).toBe('pending')
    expect(invitationState(invitation, new Date('2026-11-14T10:00:00Z'))).toBe('expired')
    expect(canReplaceInvitation(invitation, new Date('2026-11-14T10:00:00Z'))).toBe(true)
    expect(canReplaceInvitation({ ...invitation, status: 'accepted' })).toBe(false)
  })

  it('não inclui dados clínicos na mensagem', () => {
    const message = invitationMessage('https://example.test/convite/opaque')
    expect(message).toContain('AtriaNutri')
    expect(message).not.toContain('patient')
    expect(message).not.toContain('diagnóstico')
  })

  it('mantém publicada a versão escolhida após o rascunho mudar', () => {
    const plan: MealPlan = { id: 'plan', patientId: 'patient', title: 'Plano', status: 'draft', version: 3, updatedAt: '', meals: [{ id: 'draft', name: 'Rascunho', time: '12:00', guidance: '', foods: [] }], revisions: [{ version: 1, savedAt: '2026-11-01', summary: '', meals: [{ id: 'published', name: 'Publicada', time: '08:00', guidance: '', foods: [] }] }, { version: 3, savedAt: '2026-11-10', summary: '', meals: [{ id: 'draft', name: 'Rascunho', time: '12:00', guidance: '', foods: [] }] }] }
    const publication: MealPlanPublication = { id: 'publication', organizationId: 'org', patientId: 'patient', mealPlanId: 'plan', version: 1, professionalId: 'professional', status: 'active', publishedAt: '2026-11-10' }
    expect(publishedPlanVersion([plan], [publication], 'org', 'patient')?.meals[0].name).toBe('Publicada')
  })
})
