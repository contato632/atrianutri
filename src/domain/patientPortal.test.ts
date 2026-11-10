import { describe, expect, it } from 'vitest'
import { demoWorkspace } from '../data/demo-data'
import { authenticateDemoPatient, patientPortalSnapshot } from './patientPortal'

describe('portal do paciente', () => {
  it('autentica somente a conta fictícia vinculada', () => {
    expect(authenticateDemoPatient('ANA.EXEMPLO@DEMO.LOCAL', 'ATRIA-DEMO')).toBe('demo-patient-ana')
    expect(() => authenticateDemoPatient('rafael.exemplo@demo.local', 'ATRIA-DEMO')).toThrow('inválido')
  })

  it('isola integralmente o paciente e remove notas privadas', () => {
    const snapshot = patientPortalSnapshot(demoWorkspace, 'demo-patient-ana')
    expect(snapshot.patient.fullName).toBe('Ana Beatriz Lima')
    expect(snapshot.plan?.status).toBe('active')
    expect(snapshot.diaryEntries.every((item) => item.patientId === snapshot.patient.id)).toBe(true)
    expect(snapshot.goals.every((item) => item.patientId === snapshot.patient.id && !('professionalPrivateNote' in item))).toBe(true)
    expect(snapshot.checkIns.every((item) => !('professionalPrivateNote' in item))).toBe(true)
    expect(JSON.stringify(snapshot)).not.toContain('Retomar estratégias individualizadas')
    expect(JSON.stringify(snapshot)).not.toContain('Rafael Monteiro')
    expect(JSON.stringify(snapshot)).not.toContain('charge-ana')
  })

  it('não expõe registros profissionais não compartilhados', () => {
    const snapshot = patientPortalSnapshot(demoWorkspace, 'demo-patient-ana')
    expect(snapshot.diaryEntries.map((item) => item.id)).not.toContain('diary-ana-2')
    expect(snapshot.goals.map((item) => item.id)).not.toContain('habit-ana-2')
  })
})
