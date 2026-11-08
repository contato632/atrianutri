import { describe, expect, it } from 'vitest'
import { assessmentSchema, patientSchema } from './validation'

describe('patientSchema', () => {
  it('aceita cadastro administrativo válido', () => {
    expect(patientSchema.safeParse({ fullName: 'Maria de Souza', birthDate: '1990-05-12', phone: '(11) 99999-9999', email: 'maria@example.com', status: 'active' }).success).toBe(true)
  })

  it('rejeita nome, e-mail e data inválidos', () => {
    const result = patientSchema.safeParse({ fullName: 'M', birthDate: '2999-01-01', phone: '1', email: 'incorreto', status: 'active' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['fullName', 'birthDate', 'phone', 'email']))
  })
})

describe('assessmentSchema', () => {
  it('mantém medidas opcionais e valida os limites principais', () => {
    expect(assessmentSchema.safeParse({ patientId: 'patient-1', assessedAt: '2026-11-08', weightKg: 72.4, heightCm: 168, notes: '' }).success).toBe(true)
    expect(assessmentSchema.safeParse({ patientId: 'patient-1', assessedAt: '2026-11-08', weightKg: 72.4, heightCm: 500, notes: '' }).success).toBe(false)
  })
})
