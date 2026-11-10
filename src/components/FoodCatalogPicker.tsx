import { Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { demoFoodCatalog, searchFoodCatalog } from '../domain/foodCatalog'
import { createCatalogFoodItem } from '../domain/mealPlanning'
import type { FoodCompositionSnapshot, FoodItem, NutrientDatum, NutrientKey } from '../domain/models'

const newId = () => `food-${crypto.randomUUID()}`
const keys: NutrientKey[] = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sodiumMg']

export function FoodCatalogPicker({ onAdd }: { onAdd: (food: FoodItem) => void }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchFoodCatalog(query), [query])

  function addCustom(form: HTMLFormElement) {
    const data = new FormData(form); const name = String(data.get('name') ?? '').trim(); const amount = Number(data.get('amount')); const unit = String(data.get('unit')) as 'g' | 'ml'
    if (!name || !Number.isFinite(amount) || amount <= 0) return
    const nutrients = Object.fromEntries(keys.map((key) => { const value = String(data.get(key) ?? '').trim(); return [key, value === '' ? { status: 'unavailable' } : { status: 'known', value: Number(value) }] })) as Record<NutrientKey, NutrientDatum>
    const composition: FoodCompositionSnapshot = { foodName: name, category: 'Personalizado', preparation: 'Definida pelo profissional', sourceId: 'professional-custom', sourceName: 'Cadastro manual do profissional', sourceVersion: 'Snapshot da versão', sourceLicense: 'Valores informados e revisados pelo profissional responsável.', demonstrative: false, referenceAmount: 100, referenceUnit: unit, nutrients, householdMeasures: [] }
    onAdd({ id: newId(), name, quantity: `${amount.toLocaleString('pt-BR')} ${unit}`, portion: { amount, unit }, composition })
    setCustom(false); setOpen(false); setQuery(''); form.reset()
  }

  if (!open) return <div className="food-picker-actions"><button type="button" className="add-food" onClick={() => setOpen(true)}><Search size={15} /> Pesquisar no catálogo</button><button type="button" className="add-food" onClick={() => { setOpen(true); setCustom(true) }}><Plus size={15} /> Alimento personalizado</button></div>

  return <section className="food-picker" aria-label="Catálogo de alimentos demonstrativo">
    <header><div><strong>{custom ? 'Alimento personalizado' : 'Catálogo de alimentos'}</strong><small>Valores demonstrativos — não usar como referência científica.</small></div><button type="button" onClick={() => { setOpen(false); setCustom(false) }} aria-label="Fechar catálogo"><X size={15} /></button></header>
    {custom ? <form className="custom-food-form" onSubmit={(event) => { event.preventDefault(); addCustom(event.currentTarget) }}>
      <div className="field-grid field-grid--2"><label className="field"><span>Nome do alimento</span><input name="name" required maxLength={200} /></label><label className="field"><span>Porção usada</span><span className="compound-input"><input name="amount" type="number" min="0.01" step="0.01" required aria-label="Quantidade da porção personalizada" /><select name="unit" aria-label="Unidade da porção personalizada"><option value="g">g</option><option value="ml">ml</option></select></span></label></div>
      <p>Composição por 100 g ou 100 ml. Deixe em branco quando o dado não estiver disponível.</p>
      <div className="custom-nutrients">{keys.map((key) => <label key={key}><span>{{ energyKcal: 'kcal', proteinG: 'Proteínas (g)', carbohydrateG: 'Carboidratos (g)', fatG: 'Gorduras (g)', fiberG: 'Fibras (g)', sodiumMg: 'Sódio (mg)' }[key]}</span><input name={key} type="number" min="0" step="0.01" /></label>)}</div>
      <div className="form-actions"><button type="button" className="button button--ghost" onClick={() => setCustom(false)}>Voltar ao catálogo</button><button className="button button--primary">Adicionar alimento</button></div>
    </form> : <><label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alimento ou categoria" autoFocus aria-label="Buscar alimento no catálogo" /></label><div className="catalog-results">{results.map((food) => <button type="button" key={food.id} onClick={() => { onAdd(createCatalogFoodItem(food, newId())); setOpen(false); setQuery('') }}><span><strong>{food.foodName}</strong><small>{food.category} · {food.preparation}</small></span><span>{food.referenceAmount} {food.referenceUnit}<small>{food.sourceVersion}</small></span><Plus size={15} /></button>)}{!results.length && <p>Nenhum item encontrado neste catálogo demonstrativo.</p>}</div><footer><span>{demoFoodCatalog.length} itens fictícios para validar a arquitetura.</span><button type="button" className="text-button" onClick={() => setCustom(true)}>Cadastrar alimento próprio</button></footer></>}
  </section>
}
