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
      nextAppointment: '2026-11-12T15:30:00.000Z',
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
        { version: 1, savedAt: '2026-10-22T14:00:00.000Z', summary: 'Estrutura inicial criada', meals: [
          { id: 'meal-breakfast-v1', name: 'Café da manhã', time: '08:00', guidance: 'Observar a saciedade.', foods: [{ id: 'food-v1', name: 'Item definido pelo profissional', quantity: 'Porção individualizada' }] },
        ] },
        { version: 2, savedAt: DEMO_NOW, summary: 'Horários e orientações ajustados', meals: [
          { id: 'meal-breakfast', name: 'Café da manhã', time: '07:30', guidance: 'Realizar com calma e observar a saciedade.', foods: [{ id: 'food-1', name: 'Item definido pelo profissional', quantity: 'Porção individualizada' }, { id: 'food-2', name: 'Fruta de preferência', quantity: '1 porção orientada' }] },
          { id: 'meal-lunch', name: 'Almoço', time: '12:30', guidance: 'Priorizar variedade e ambiente sem distrações.', foods: [{ id: 'food-3', name: 'Composição definida em consulta', quantity: 'Conforme orientação' }] },
        ] },
      ],
    },
  ],
  foodDiaryEntries: [
    { id: 'diary-ana-1', patientId: 'demo-patient-ana', entryDate: '2026-11-08', mealTime: '07:40', mealType: 'breakfast', foods: [{ id: 'diary-food-1', name: 'Pão com ovo', quantity: '1 unidade' }, { id: 'diary-food-2', name: 'Café com leite', quantity: '1 xícara' }], notes: 'Refeição feita antes do trabalho.', eatingContext: 'Em casa, com tempo suficiente.', hungerBefore: 'Fome moderada ao acordar.', satietyAfter: 'Satisfeita até próximo do almoço.', routineChanges: '', source: 'patient', sharedWithPatient: true, professionalPrivateNote: 'Observar regularidade em dias de trabalho presencial.', submissionKey: '10000000-0000-4000-8000-000000000101', createdAt: '2026-11-08T10:45:00.000Z', updatedAt: '2026-11-08T10:45:00.000Z' },
    { id: 'diary-ana-2', patientId: 'demo-patient-ana', entryDate: '2026-11-07', mealTime: '13:10', mealType: 'lunch', foods: [{ id: 'diary-food-3', name: 'Arroz, feijão e preparação caseira', quantity: 'Quantidade não informada' }], notes: '', eatingContext: 'Almoço durante intervalo de reunião.', hungerBefore: 'Fome intensa pelo atraso do horário.', satietyAfter: '', routineChanges: 'Horário do almoço mudou por demanda de trabalho.', source: 'professional', sharedWithPatient: false, professionalPrivateNote: 'Retomar estratégias individualizadas para dias com reuniões consecutivas.', submissionKey: '10000000-0000-4000-8000-000000000102', createdAt: '2026-11-07T17:00:00.000Z', updatedAt: '2026-11-07T17:00:00.000Z' },
    { id: 'diary-ana-3', patientId: 'demo-patient-ana', entryDate: '2026-11-05', mealTime: '20:15', mealType: 'dinner', foods: [{ id: 'diary-food-4', name: 'Sopa preparada em casa', quantity: '1 prato' }], notes: 'Preparou a refeição com antecedência.', eatingContext: 'Em casa.', hungerBefore: '', satietyAfter: 'Confortável após a refeição.', routineChanges: '', source: 'patient', sharedWithPatient: true, professionalPrivateNote: '', submissionKey: '10000000-0000-4000-8000-000000000103', createdAt: '2026-11-05T23:30:00.000Z', updatedAt: '2026-11-05T23:30:00.000Z' },
  ],
  habitGoals: [
    { id: 'habit-ana-1', patientId: 'demo-patient-ana', title: 'Organizar o horário do almoço em dias de reunião', description: 'Testar uma janela possível para o almoço conforme a agenda real da semana.', status: 'active', sharedWithPatient: true, professionalPrivateNote: 'Meta construída em consulta, sem horário universal.', submissionKey: '10000000-0000-4000-8000-000000000201', createdAt: '2026-10-20T14:00:00.000Z', updatedAt: '2026-11-06T14:00:00.000Z' },
    { id: 'habit-ana-2', patientId: 'demo-patient-ana', title: 'Planejar preparações para dois jantares da semana', description: 'Escolher preparações viáveis conforme disponibilidade e preferências.', status: 'active', sharedWithPatient: false, professionalPrivateNote: '', submissionKey: '10000000-0000-4000-8000-000000000202', createdAt: '2026-10-28T14:00:00.000Z', updatedAt: '2026-10-28T14:00:00.000Z' },
  ],
  habitCheckIns: [
    { id: 'checkin-ana-1', goalId: 'habit-ana-1', patientId: 'demo-patient-ana', recordedOn: '2026-11-06', progress: 'progressing', notes: 'Conseguiu reservar o horário em dois dias.', difficulties: 'Reuniões adicionadas no mesmo dia ainda alteram a rotina.', nextStep: 'Observar quais dias precisam de alternativa combinada.', source: 'professional', sharedWithPatient: true, professionalPrivateNote: '', submissionKey: '10000000-0000-4000-8000-000000000301', createdAt: '2026-11-06T14:00:00.000Z', updatedAt: '2026-11-06T14:00:00.000Z' },
    { id: 'checkin-ana-2', goalId: 'habit-ana-2', patientId: 'demo-patient-ana', recordedOn: '2026-11-04', progress: 'difficulty', notes: 'O planejamento foi iniciado, mas não coube na rotina desta semana.', difficulties: 'Chegou mais tarde em casa em três dias.', nextStep: 'Reavaliar uma opção mais simples na próxima conversa.', source: 'patient', sharedWithPatient: true, professionalPrivateNote: 'Evitar ampliar a meta antes de revisar a disponibilidade.', submissionKey: '10000000-0000-4000-8000-000000000302', createdAt: '2026-11-04T21:00:00.000Z', updatedAt: '2026-11-04T21:00:00.000Z' },
  ],
  nutritionEvaluations: [
    { id: 'evaluation-ana-1', patientId: 'demo-patient-ana', evaluatedOn: '2026-11-06', consultationReason: 'Revisar a organização alimentar diante de mudanças na rotina de trabalho.', healthHistory: 'Informações de saúde fictícias registradas para demonstração.', reportedAllergies: 'Nenhuma alergia relatada neste registro fictício.', reportedMedications: 'Uso informado de suplemento fictício, sem prescrição pelo aplicativo.', previousNutritionCare: 'Acompanhamento anterior relatado, sem detalhes adicionais.', foodRestrictionsAndPreferences: 'Prefere preparações caseiras e relata baixa disponibilidade em dias presenciais.', usualMealSchedule: 'Café pela manhã, almoço com horário variável e jantar em casa.', usualMealsCount: 'Três a quatro refeições relatadas, conforme o dia.', mealEnvironment: 'Maioria das refeições em casa; almoço por vezes durante reuniões.', foodAccess: 'Acesso relatado a mercado e preparo doméstico.', hydration: 'Relato livre de hidratação irregular durante reuniões.', reportedDifficulties: 'Mudanças de agenda e reuniões consecutivas.', professionalObservations: 'Avaliar contexto e viabilidade das metas sem julgamento de adesão.', authorLabel: 'Dra. Marina Costa', submissionKey: '50000000-0000-4000-8000-000000000001', createdAt: '2026-11-06T14:00:00.000Z', updatedAt: '2026-11-06T14:00:00.000Z' },
  ],
  dietaryRecalls24h: [
    { id: 'recall-ana-1', evaluationId: 'evaluation-ana-1', patientId: 'demo-patient-ana', recallDate: '2026-11-05', meals: [
      { id: 'recall-meal-1', name: 'Café da manhã', time: '07:40', foods: [{ id: 'recall-food-1', name: 'Pão com ovo', quantity: '1 unidade relatada' }, { id: 'recall-food-2', name: 'Café com leite', quantity: '1 xícara relatada' }], context: 'Em casa antes do trabalho.', notes: '' },
      { id: 'recall-meal-2', name: 'Almoço', time: '13:20', foods: [{ id: 'recall-food-3', name: 'Preparação caseira variada', quantity: 'Quantidade não informada' }], context: 'Durante intervalo entre reuniões.', notes: 'Horário aproximado.' },
    ], complementaryNotes: 'Recordatório retrospectivo fictício; não representa o diário contínuo.', authorLabel: 'Dra. Marina Costa', submissionKey: '50000000-0000-4000-8000-000000000002', createdAt: '2026-11-06T14:10:00.000Z', updatedAt: '2026-11-06T14:10:00.000Z' },
  ],
  professionalServices: [
    {id:'service-initial',name:'Consulta nutricional inicial',defaultDurationMinutes:60,priceCents:25000,active:true,createdAt:DEMO_NOW,updatedAt:DEMO_NOW},
    {id:'service-followup',name:'Retorno nutricional',defaultDurationMinutes:40,priceCents:15000,active:true,createdAt:DEMO_NOW,updatedAt:DEMO_NOW},
  ],
  appointments: [
    {id:'appointment-ana',patientId:'demo-patient-ana',serviceId:'service-followup',professionalId:'demo-professional-marina',professionalLabel:'Dra. Marina',category:'follow-up',status:'confirmed',title:'Retorno nutricional',privateTitle:'',administrativeNote:'Confirmado por telefone no cenário fictício.',startsAt:'2026-11-12T15:30:00.000Z',endsAt:'2026-11-12T16:10:00.000Z',recurrenceFrequency:'none',createdAt:DEMO_NOW,updatedAt:DEMO_NOW},
    {id:'appointment-lunch-1',seriesId:'series-lunch',professionalId:'demo-professional-marina',professionalLabel:'Dra. Marina',category:'lunch-break',status:'scheduled',title:'Horário de almoço',privateTitle:'',administrativeNote:'',startsAt:'2026-11-09T15:00:00.000Z',endsAt:'2026-11-09T15:30:00.000Z',recurrenceFrequency:'weekly',recurrenceEndsOn:'2026-12-31',createdAt:DEMO_NOW,updatedAt:DEMO_NOW},
    {id:'appointment-rafael',patientId:'demo-patient-rafael',serviceId:'service-initial',professionalId:'demo-professional-marina',professionalLabel:'Dra. Marina',category:'nutrition-consultation',status:'scheduled',title:'Consulta nutricional',privateTitle:'',administrativeNote:'',startsAt:'2026-11-10T18:00:00.000Z',endsAt:'2026-11-10T19:00:00.000Z',recurrenceFrequency:'none',createdAt:DEMO_NOW,updatedAt:DEMO_NOW},
    {id:'appointment-personal',professionalId:'demo-professional-marina',professionalLabel:'Dra. Marina',category:'personal',status:'scheduled',title:'Compromisso particular',privateTitle:'Assunto pessoal fictício',administrativeNote:'',startsAt:'2026-11-11T19:00:00.000Z',endsAt:'2026-11-11T20:00:00.000Z',recurrenceFrequency:'none',createdAt:DEMO_NOW,updatedAt:DEMO_NOW},
  ],
  financialCharges: [
    {id:'charge-ana',patientId:'demo-patient-ana',professionalId:'demo-professional-marina',appointmentId:'appointment-ana',serviceId:'service-followup',description:'Retorno nutricional',amountCents:15000,dueDate:'2026-11-09',administrativeNote:'Cobrança demonstrativa.',createdAt:'2026-11-01T12:00:00.000Z',updatedAt:DEMO_NOW},
    {id:'charge-rafael',patientId:'demo-patient-rafael',professionalId:'demo-professional-marina',appointmentId:'appointment-rafael',serviceId:'service-initial',description:'Consulta nutricional inicial',amountCents:25000,dueDate:'2026-11-10',administrativeNote:'',createdAt:'2026-11-02T12:00:00.000Z',updatedAt:DEMO_NOW},
    {id:'charge-luiza',patientId:'demo-patient-luiza',professionalId:'demo-professional-marina',description:'Consulta demonstrativa anterior',amountCents:20000,dueDate:'2026-10-20',administrativeNote:'',createdAt:'2026-10-10T12:00:00.000Z',updatedAt:DEMO_NOW},
  ],
  financialPayments: [
    {id:'payment-ana-1',chargeId:'charge-ana',kind:'receipt',amountCents:5000,method:'pix',receivedAt:'2026-11-05',administrativeNote:'Parcela demonstrativa',idempotencyKey:'80000000-0000-4000-8000-000000000001',installmentNumber:1,installmentCount:2,createdAt:'2026-11-05T13:00:00.000Z',createdByLabel:'Dra. Marina'},
    {id:'payment-luiza-1',chargeId:'charge-luiza',kind:'receipt',amountCents:20000,method:'credit-card',receivedAt:'2026-10-18',administrativeNote:'',idempotencyKey:'80000000-0000-4000-8000-000000000002',createdAt:'2026-10-18T13:00:00.000Z',createdByLabel:'Dra. Marina'},
  ],
  expenseCategories: [
    {id:'expense-cat-rent',name:'Aluguel',active:true},{id:'expense-cat-software',name:'Softwares',active:true},{id:'expense-cat-materials',name:'Materiais',active:true},{id:'expense-cat-services',name:'Serviços',active:true},{id:'expense-cat-team',name:'Equipe',active:true},{id:'expense-cat-other',name:'Outras despesas operacionais',active:true},
  ],
  financialExpenses: [
    {id:'expense-software',categoryId:'expense-cat-software',description:'Software administrativo fictício',amountCents:8900,competenceDate:'2026-11-01',dueDate:'2026-11-05',paidAt:'2026-11-05',status:'paid',administrativeNote:'Ambiente demonstrativo.',createdAt:'2026-11-01T10:00:00.000Z',updatedAt:'2026-11-05T10:00:00.000Z'},
    {id:'expense-materials',categoryId:'expense-cat-materials',description:'Materiais de consultório fictícios',amountCents:6500,competenceDate:'2026-11-01',dueDate:'2026-11-15',status:'planned',administrativeNote:'',createdAt:'2026-11-02T10:00:00.000Z',updatedAt:'2026-11-02T10:00:00.000Z'},
  ],
  patientInvitations: [],
  patientLinks: [
    { id: 'link-ana', organizationId: 'demo-organization', patientId: 'demo-patient-ana', professionalId: 'demo-professional-marina', professionalName: 'Dra. Marina Costa', patientUserId: 'demo-user-ana', status: 'active', activatedAt: '2026-10-20T14:00:00.000Z', createdAt: '2026-10-20T14:00:00.000Z' },
  ],
  mealPlanPublications: [
    { id: 'publication-ana-v2', organizationId: 'demo-organization', patientId: 'demo-patient-ana', mealPlanId: 'plan-ana', version: 2, professionalId: 'demo-professional-marina', status: 'active', publishedAt: '2026-11-08T13:00:00.000Z' },
  ],
}
