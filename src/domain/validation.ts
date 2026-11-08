import { z } from 'zod'

export const patientSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(160),
  birthDate: z.string().date('Informe uma data válida.').refine((value) => new Date(`${value}T12:00:00`) <= new Date(), 'A data não pode estar no futuro.'),
  phone: z.string().trim().min(10, 'Informe um telefone com DDD.').max(24),
  email: z.string().trim().email('Informe um e-mail válido.').max(320),
  status: z.enum(['active', 'follow-up', 'paused']),
  nextAppointment: z.string().optional(),
})

export const clinicalProfileSchema = z.object({
  goal: z.string().trim().max(4000, 'O objetivo deve ter no máximo 4.000 caracteres.'),
  foodHistory: z.string().trim().max(12000, 'O histórico deve ter no máximo 12.000 caracteres.'),
  habits: z.string().trim().max(12000, 'O registro de hábitos deve ter no máximo 12.000 caracteres.'),
  professionalNotes: z.string().trim().max(12000, 'As observações devem ter no máximo 12.000 caracteres.'),
})

export const assessmentSchema = z.object({
  patientId: z.string().min(1, 'Selecione um paciente.'),
  assessedAt: z.string().date('Informe uma data válida.'),
  weightKg: z.number().min(1, 'Peso inválido.').max(500, 'Peso inválido.'),
  heightCm: z.number().min(50, 'Altura inválida.').max(250, 'Altura inválida.'),
  waistCm: z.number().positive().max(300).optional(),
  hipCm: z.number().positive().max(300).optional(),
  armCm: z.number().positive().max(100).optional(),
  bodyFatPercentage: z.number().min(1).max(80).optional(),
  notes: z.string().trim().max(2000),
})
