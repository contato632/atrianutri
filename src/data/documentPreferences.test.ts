import { describe, expect, it } from 'vitest'
import { defaultDocumentBranding } from '../domain/documents'
import { SessionDocumentPreferencesRepository } from './documentPreferences'

describe('preferências profissionais de documentos', () => {
  it('isola as preferências por organização e profissional durante a sessão', async () => {
    const repository = new SessionDocumentPreferencesRepository()
    const first = { organizationId: 'org-a', professionalId: 'professional-a' }
    const otherProfessional = { organizationId: 'org-a', professionalId: 'professional-b' }
    const otherOrganization = { organizationId: 'org-b', professionalId: 'professional-a' }
    await repository.save(first, { ...defaultDocumentBranding(), professionalName: 'Profissional A', crn: 'CRN-5 12345' })
    expect((await repository.load(first))?.professionalName).toBe('Profissional A')
    expect(await repository.load(otherProfessional)).toBeNull()
    expect(await repository.load(otherOrganization)).toBeNull()
  })

  it('devolve cópias para a personalização individual não alterar o padrão geral', async () => {
    const repository = new SessionDocumentPreferencesRepository()
    const scope = { organizationId: 'org-a', professionalId: 'professional-a' }
    await repository.save(scope, { ...defaultDocumentBranding(), professionalName: 'Profissional Geral', crn: 'CRN-5 12345' })
    const individual = await repository.load(scope)
    individual!.clinicName = 'Clínica apenas do documento'
    expect((await repository.load(scope))?.clinicName).toBe('AtriaNutri')
  })
})
