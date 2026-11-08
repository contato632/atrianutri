import { describe, expect, it } from 'vitest'
import type { FoodDiaryEntry } from './models'
import { filterFoodDiaryEntries } from './foodDiary'

const entry = (id: string, entryDate: string, mealType: FoodDiaryEntry['mealType']): FoodDiaryEntry => ({
  id, patientId: 'patient-ficticio', entryDate, mealTime: '12:00', mealType,
  foods: [{ id: `food-${id}`, name: 'Refeição fictícia', quantity: '' }], notes: '', eatingContext: '',
  hungerBefore: '', satietyAfter: '', routineChanges: '', source: 'patient', sharedWithPatient: true,
  professionalPrivateNote: '', submissionKey: `40000000-0000-4000-8000-00000000000${id}`, createdAt: '', updatedAt: '',
})

describe('filterFoodDiaryEntries', () => {
  const entries = [entry('1', '2026-11-08', 'breakfast'), entry('2', '2026-11-04', 'lunch'), entry('3', '2026-10-01', 'lunch')]

  it('limita o período a partir do registro mais recente', () => {
    expect(filterFoodDiaryEntries(entries, '7', 'all').map((item) => item.id)).toEqual(['1', '2'])
  })

  it('combina período e tipo de refeição', () => {
    expect(filterFoodDiaryEntries(entries, '30', 'lunch').map((item) => item.id)).toEqual(['2'])
    expect(filterFoodDiaryEntries(entries, 'all', 'lunch').map((item) => item.id)).toEqual(['2', '3'])
  })
})
