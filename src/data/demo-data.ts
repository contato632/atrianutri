import type { NutritionWorkspace } from '../domain/models'

export const DEMO_NOW = '2026-11-08T13:00:00.000Z'

export const demoWorkspace: NutritionWorkspace = {
  patients: [
    {
      id: 'demo-patient-ana',
      fullName: 'Ana Beatriz Lima',
      birthDate: '1992-04-18',
      phone: '(11) 98888-1020',
      email: 'ana.exemplo@demo.local',
      status: 'active',
      nextAppointment: '2026-11-09T12:30:00.000Z',
      createdAt: '2026-07-03T10:00:00.000Z',
    },
    {
      id: 'demo-patient-rafael',
      fullName: 'Rafael Monteiro',
      birthDate: '1987-09-02',
      phone: '(71) 97777-4412',
      email: 'rafael.exemplo@demo.local',
      status: 'follow-up',
      nextAppointment: '2026-11-10T15:00:00.000Z',
      createdAt: '2026-08-22T13:45:00.000Z',
    },
    {
      id: 'demo-patient-luiza',
      fullName: 'Luiza Campos',
      birthDate: '1998-12-11',
      phone: '(21) 96666-2081',
      email: 'luiza.exemplo@demo.local',
      status: 'active',
      nextAppointment: '2026-11-12T17:30:00.000Z',
      createdAt: '2026-09-14T09:20:00.000Z',
    },
    {
      id: 'demo-patient-marcos',
      fullName: 'Marcos Vinícius Alves',
      birthDate: '1979-06-25',
      phone: '(31) 95555-9231',
      email: 'marcos.exemplo@demo.local',
      status: 'paused',
      createdAt: '2026-04-02T18:00:00.000Z',
    },
  ],
  clinicalProfiles: [
    { patientId: 'demo-patient-ana', goal: 'Melhorar rotina alimentar e disposição.', foodHistory: '', habits: '', professionalNotes: 'Rotina de trabalho com horários variáveis.', updatedAt: DEMO_NOW },
    { patientId: 'demo-patient-rafael', goal: 'Acompanhamento da composição corporal.', foodHistory: '', habits: '', professionalNotes: 'Reavaliar tolerância e preferências na próxima consulta.', updatedAt: DEMO_NOW },
    { patientId: 'demo-patient-luiza', goal: 'Organizar refeições durante a semana.', foodHistory: '', habits: '', professionalNotes: 'Planejamento inicial em construção.', updatedAt: DEMO_NOW },
    { patientId: 'demo-patient-marcos', goal: 'Retomar acompanhamento.', foodHistory: '', habits: '', professionalNotes: 'Acompanhamento pausado pelo paciente.', updatedAt: DEMO_NOW },
  ],
  assessments: [
    { id: 'assess-ana-1', patientId: 'demo-patient-ana', assessedAt: '2026-08-02', weightKg: 71.8, heightCm: 168, waistCm: 82, hipCm: 101, armCm: 29, bmi: 25.4, notes: 'Avaliação inicial demonstrativa.', createdAt: '2026-08-02T14:00:00.000Z' },
    { id: 'assess-ana-2', patientId: 'demo-patient-ana', assessedAt: '2026-09-06', weightKg: 70.9, heightCm: 168, waistCm: 80.5, hipCm: 100, armCm: 29, bmi: 25.1, notes: 'Boa adaptação à rotina combinada.', createdAt: '2026-09-06T14:00:00.000Z' },
    { id: 'assess-ana-3', patientId: 'demo-patient-ana', assessedAt: '2026-10-11', weightKg: 69.7, heightCm: 168, waistCm: 79, hipCm: 99, armCm: 28.5, bmi: 24.7, notes: 'Dados fictícios para visualização da evolução.', createdAt: '2026-10-11T14:00:00.000Z' },
    { id: 'assess-rafael-1', patientId: 'demo-patient-rafael', assessedAt: '2026-09-10', weightKg: 86.2, heightCm: 179, waistCm: 94, hipCm: 104, armCm: 34, bmi: 26.9, notes: 'Avaliação demonstrativa.', createdAt: '2026-09-10T16:00:00.000Z' },
    { id: 'assess-rafael-2', patientId: 'demo-patient-rafael', assessedAt: '2026-10-16', weightKg: 85.1, heightCm: 179, waistCm: 92.5, hipCm: 103, armCm: 34, bmi: 26.6, notes: 'Medidas fictícias.', createdAt: '2026-10-16T16:00:00.000Z' },
  ],
  mealPlans: [
    {
      id: 'plan-ana',
      patientId: 'demo-patient-ana',
      title: 'Plano de organização semanal',
      status: 'draft',
      version: 2,
      updatedAt: DEMO_NOW,
      meals: [
        { id: 'meal-breakfast', name: 'Café da manhã', time: '07:30', guidance: 'Realizar com calma e observar a saciedade.', foods: [
          { id: 'food-1', name: 'Item definido pelo profissional', quantity: 'Porção individualizada' },
          { id: 'food-2', name: 'Fruta de preferência', quantity: '1 porção orientada' },
        ] },
        { id: 'meal-lunch', name: 'Almoço', time: '12:30', guidance: 'Priorizar variedade e ambiente sem distrações.', foods: [
          { id: 'food-3', name: 'Composição definida em consulta', quantity: 'Conforme orientação' },
        ] },
      ],
      revisions: [
        { version: 1, savedAt: '2026-10-22T14:00:00.000Z', summary: 'Estrutura inicial criada' },
        { version: 2, savedAt: DEMO_NOW, summary: 'Horários e orientações ajustados' },
      ],
    },
  ],
}
