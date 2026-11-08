import type { FoodDiaryEntry, FoodDiaryMealType } from './models'

export function filterFoodDiaryEntries(
  entries: FoodDiaryEntry[],
  period: '7' | '30' | '90' | 'all',
  mealType: 'all' | FoodDiaryMealType,
) {
  const latestDate = entries[0]?.entryDate
  const cutoff = latestDate && period !== 'all'
    ? new Date(`${latestDate}T12:00:00Z`).getTime() - (Number(period) - 1) * 86_400_000
    : null
  return entries.filter((entry) => (
    (mealType === 'all' || entry.mealType === mealType)
    && (!cutoff || new Date(`${entry.entryDate}T12:00:00Z`).getTime() >= cutoff)
  ))
}
