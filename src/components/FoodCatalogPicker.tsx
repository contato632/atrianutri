import { Check, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { demoFoodCatalog, type CatalogFood } from '../domain/foodCatalog'
import { createCatalogFoodItem } from '../domain/mealPlanning'
import type { FoodCompositionSnapshot, FoodItem, NutrientDatum, NutrientKey } from '../domain/models'
import { scientificCatalogMetadata, scientificFoodCatalog, searchCatalog } from '../domain/scientificCatalog'

const newId = () => `food-${crypto.randomUUID()}`
const keys: NutrientKey[] = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sodiumMg']
const demoMode = import.meta.env.VITE_DATA_MODE !== 'supabase'

export function FoodCatalogPicker({ onAdd }: { onAdd: (food: FoodItem) => void }) {
  const [open, setOpen] = useState(false); const [custom, setCustom] = useState(false); const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'scientific' | 'demo'>(demoMode && !scientificFoodCatalog.length ? 'demo' : 'scientific')
  const [category, setCategory] = useState(''); const [sort, setSort] = useState<'name' | 'category' | 'source-code'>('name'); const [selected, setSelected] = useState<CatalogFood | null>(null)
  const catalog = scope === 'scientific' ? scientificFoodCatalog : demoMode ? demoFoodCatalog : []
  const categories = useMemo(() => Array.from(new Set(catalog.map((food) => food.category))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [catalog])
  const results = useMemo(() => searchCatalog(catalog, { query, category, sort }), [catalog, category, query, sort])

  function resetPicker() { setOpen(false); setCustom(false); setSelected(null); setQuery(''); setCategory('') }
  function addCustom(form: HTMLFormElement) {
    const data = new FormData(form); const name = String(data.get('name') ?? '').trim(); const amount = Number(data.get('amount')); const unit = String(data.get('unit')) as 'g' | 'ml'
    if (!name || !Number.isFinite(amount) || amount <= 0) return
    const nutrients = Object.fromEntries(keys.map((key) => { const value = String(data.get(key) ?? '').trim(); return [key, value === '' ? { status: 'unavailable' } : { status: 'known', value: Number(value) }] })) as Record<NutrientKey, NutrientDatum>
    const composition: FoodCompositionSnapshot = { foodName: name, category: 'Personalizado', preparation: 'Definida pelo profissional', catalogType: 'professional', sourceId: 'professional-custom', sourceName: 'Cadastro manual do profissional', sourceVersion: 'Snapshot da versão', sourceLicense: 'Valores informados e revisados pelo profissional responsável.', demonstrative: false, referenceAmount: 100, referenceUnit: unit, nutrients, householdMeasures: [] }
    onAdd({ id: newId(), name, quantity: `${amount.toLocaleString('pt-BR')} ${unit}`, portion: { amount, unit }, composition }); resetPicker(); form.reset()
  }

  if (!open) return <div className="food-picker-actions"><button type="button" className="add-food" onClick={() => setOpen(true)}><Search size={15} /> Pesquisar no catálogo</button><button type="button" className="add-food" onClick={() => { setOpen(true); setCustom(true) }}><Plus size={15} /> Alimento personalizado</button></div>

  return <section className="food-picker" aria-label="Catálogo alimentar">
    <header><div><strong>{custom ? 'Alimento personalizado' : 'Catálogo alimentar rastreável'}</strong><small>{scope === 'scientific' ? `${scientificCatalogMetadata.name} · ${scientificCatalogMetadata.license}` : 'Demonstração isolada — valores não científicos'}</small></div><button type="button" onClick={resetPicker} aria-label="Fechar catálogo"><X size={15} /></button></header>
    {custom ? <form className="custom-food-form" onSubmit={(event) => { event.preventDefault(); addCustom(event.currentTarget) }}>
      <div className="field-grid field-grid--2"><label className="field"><span>Nome do alimento</span><input name="name" required maxLength={200} /></label><label className="field"><span>Porção usada</span><span className="compound-input"><input name="amount" type="number" min="0.01" step="0.01" required aria-label="Quantidade da porção personalizada" /><select name="unit" aria-label="Unidade da porção personalizada"><option value="g">g</option><option value="ml">ml</option></select></span></label></div>
      <p>Composição por 100 g ou 100 ml. Deixe em branco quando o dado não estiver disponível.</p><div className="custom-nutrients">{keys.map((key) => <label key={key}><span>{{ energyKcal: 'kcal', proteinG: 'Proteínas (g)', carbohydrateG: 'Carboidratos (g)', fatG: 'Gorduras (g)', fiberG: 'Fibras (g)', sodiumMg: 'Sódio (mg)' }[key]}</span><input name={key} type="number" min="0" step="0.01" /></label>)}</div><div className="form-actions"><button type="button" className="button button--ghost" onClick={() => setCustom(false)}>Voltar ao catálogo</button><button className="button button--primary">Adicionar alimento</button></div>
    </form> : <>
      <div className="catalog-scope" role="tablist" aria-label="Origem do catálogo"><button type="button" role="tab" aria-selected={scope === 'scientific'} className={scope === 'scientific' ? 'active' : ''} onClick={() => { setScope('scientific'); setSelected(null); setCategory('') }}>Científico <span>{scientificFoodCatalog.length}</span></button>{demoMode && <button type="button" role="tab" aria-selected={scope === 'demo'} className={scope === 'demo' ? 'active' : ''} onClick={() => { setScope('demo'); setSelected(null); setCategory('') }}>Demonstração <span>{demoFoodCatalog.length}</span></button>}</div>
      <div className="catalog-filters"><label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null) }} placeholder="Buscar nome, original, categoria ou código" autoFocus aria-label="Buscar alimento no catálogo" /></label><select value={category} onChange={(event) => { setCategory(event.target.value); setSelected(null) }} aria-label="Filtrar categoria"><option value="">Todas as categorias</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Ordenar alimentos"><option value="name">Nome</option><option value="category">Categoria</option><option value="source-code">Código da fonte</option></select></div>
      <div className="catalog-results">{results.map((food) => <button type="button" className={selected?.id === food.id ? 'active' : ''} key={food.id} onClick={() => setSelected(food)}><span><strong>{food.foodName}</strong><small>{food.originalName || `${food.category} · ${food.preparation}`}</small></span><span>{food.referenceAmount} {food.referenceUnit}<small>{food.sourceFoodCode ? `FDC ${food.sourceFoodCode}` : food.sourceVersion}</small></span>{selected?.id === food.id ? <Check size={15} /> : <Plus size={15} />}</button>)}{!results.length && <div className="catalog-empty"><strong>{scope === 'scientific' ? 'Catálogo científico ainda não incorporado' : 'Nenhum item encontrado'}</strong><p>{scope === 'scientific' ? 'O importador e as validações estão prontos, mas nenhum release oficial foi incorporado sem verificação documental e técnica.' : 'Ajuste a busca ou os filtros do catálogo demonstrativo.'}</p></div>}</div>
      {selected && <div className="catalog-confirm"><div><strong>{selected.foodName}</strong><span>{selected.sourceName} · {selected.sourceVersion} · {selected.sourceLicense}</span><small>{selected.preparation} · composição por {selected.referenceAmount} {selected.referenceUnit}</small></div><button type="button" className="button button--primary" onClick={() => { onAdd(createCatalogFoodItem(selected, newId())); resetPicker() }}>Confirmar inclusão</button></div>}
      <footer><span>{scope === 'scientific' ? `${scientificFoodCatalog.length} alimentos científicos auditados` : `${demoFoodCatalog.length} itens fictícios, exclusivos da demonstração`}</span><button type="button" className="text-button" onClick={() => setCustom(true)}>Cadastrar alimento próprio</button></footer>
    </>}
  </section>
}
