import { AlertTriangle, BarChart3 } from 'lucide-react'
import type { Meal, NutrientKey, NutritionTargets } from '../domain/models'
import { calculateMealNutrition, calculatePlanNutrition, compareToTarget, nutrientKeys, nutrientLabels, nutrientUnits } from '../domain/nutritionCalculation'

const format = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function PlanNutritionPanel({ meals, targets, onTargetsChange }: { meals: Meal[]; targets: NutritionTargets; onTargetsChange: (targets: NutritionTargets) => void }) {
  const total = calculatePlanNutrition(meals); const mealTotals = meals.map((meal) => ({ meal, total: calculateMealNutrition(meal) })); const maxEnergy = Math.max(1, ...mealTotals.map((item) => item.total.values.energyKcal))
  const setTarget = (key: NutrientKey, raw: string) => { const next = { ...targets }; if (raw) next[key] = Number(raw); else delete next[key]; onTargetsChange(next) }
  return <section className="panel nutrition-panel"><header><BarChart3 size={18} /><div><span className="eyebrow">Painel nutricional</span><h3>Composição calculada</h3></div></header>
    {total.calculatedItemCount < total.itemCount && <p className="nutrition-warning"><AlertTriangle size={14} /> Totais parciais: {total.itemCount - total.calculatedItemCount} item(ns) sem porção ou composição calculável.</p>}
    <div className="nutrition-metrics">{nutrientKeys.map((key) => { const state = total.completeness[key]; const progress = compareToTarget(total.values[key], targets[key]); return <article key={key}><span>{nutrientLabels[key]} {state === 'partial' && <small>parcial</small>}</span><strong>{state === 'unavailable' ? '—' : `${format(total.values[key])} ${nutrientUnits[key]}`}</strong>{progress !== undefined && <div title={`${format(progress)}% da meta manual`}><i style={{ width: `${Math.min(100, progress)}%` }} /></div>}</article>})}</div>
    {total.macroEnergyPercentages ? <div className="macro-distribution"><span>Distribuição energética dos macronutrientes</span>{([['Proteínas', total.macroEnergyPercentages.protein], ['Carboidratos', total.macroEnergyPercentages.carbohydrate], ['Gorduras', total.macroEnergyPercentages.fat]] as const).map(([label, value]) => <div key={label}><small>{label}</small><span><i style={{ width: `${value}%` }} /></span><strong>{format(value)}%</strong></div>)}</div> : <p className="nutrition-muted">Percentuais indisponíveis enquanto algum macronutriente estiver ausente.</p>}
    <div className="meal-distribution"><span>Energia por refeição</span>{mealTotals.map(({ meal, total: mealTotal }) => <div key={meal.id}><small>{meal.name}</small><span><i style={{ width: `${mealTotal.values.energyKcal / maxEnergy * 100}%` }} /></span><strong>{mealTotal.completeness.energyKcal === 'unavailable' ? '—' : `${format(mealTotal.values.energyKcal)} kcal`}</strong></div>)}</div>
    <details className="nutrition-targets"><summary>Comparar com metas manuais</summary><p>Metas não são geradas pelo sistema e não recebem classificação clínica.</p><div>{nutrientKeys.map((key) => <label key={key}><span>{nutrientLabels[key]} ({nutrientUnits[key]})</span><input type="number" min="0" step="0.1" value={targets[key] ?? ''} onChange={(event) => setTarget(key, event.target.value)} /></label>)}</div></details>
    <footer>Fonte dos itens calculados: snapshots registrados no plano. Itens demonstrativos não constituem dados científicos.</footer>
  </section>
}
