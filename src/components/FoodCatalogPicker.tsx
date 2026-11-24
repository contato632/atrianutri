import { Check, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { demoFoodCatalog, type CatalogFood } from '../domain/foodCatalog'
import { createCatalogFoodItem } from '../domain/mealPlanning'
import type { FoodCompositionSnapshot, FoodItem, FoodPortion, NutrientDatum, NutrientKey } from '../domain/models'
import { portionNutrition } from '../domain/nutritionCalculation'
import { scientificCatalogMetadata, scientificFoodCatalog, searchCatalog } from '../domain/scientificCatalog'

const newId = () => `food-${crypto.randomUUID()}`
const keys: NutrientKey[] = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sodiumMg']
const demoMode = import.meta.env.VITE_DATA_MODE !== 'supabase'

export function FoodCatalogPicker({ onAdd, actionLabel = 'Confirmar inclusão' }: { onAdd: (food: FoodItem) => void; actionLabel?: string }) {
  const [open, setOpen] = useState(false); const [custom, setCustom] = useState(false); const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'scientific' | 'demo'>(demoMode && !scientificFoodCatalog.length ? 'demo' : 'scientific')
  const [category, setCategory] = useState(''); const [sort, setSort] = useState<'relevance' | 'name' | 'category' | 'source-code'>('relevance'); const [selected, setSelected] = useState<CatalogFood | null>(null)
  const [portionAmount, setPortionAmount] = useState('100')
  const [portionUnit, setPortionUnit] = useState<string>('g')
  const catalog = scope === 'scientific' ? scientificFoodCatalog : demoMode ? demoFoodCatalog : []
  const categories = useMemo(() => Array.from(new Set(catalog.map((food) => food.category))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [catalog])
  const results = useMemo(() => searchCatalog(catalog, { query, category, sort }), [catalog, category, query, sort])
  const amount = Number(portionAmount)
  const portion: FoodPortion | null = selected && Number.isFinite(amount) && amount > 0
    ? portionUnit.startsWith('measure:') ? { amount, unit: 'household', measureId: portionUnit.slice(8) } : { amount, unit: portionUnit as 'g' | 'ml' }
    : null
  const previewFood = selected && portion ? createCatalogFoodItem(selected, 'preview-food', portion) : null
  const previewNutrition = previewFood ? portionNutrition(previewFood) : null
  const portionValid = previewNutrition?.resolution.valid === true
  const chosenPortionLabel = previewNutrition?.resolution.valid ? previewNutrition.resolution.label : (previewNutrition?.resolution.reason ?? 'Informe uma quantidade válida, maior que zero.')

  function chooseFood(food: CatalogFood) {
    setSelected(food)
    setPortionAmount(String(food.referenceAmount))
    setPortionUnit(food.referenceUnit)
  }
  function resetPicker() { setOpen(false); setCustom(false); setSelected(null); setQuery(''); setCategory(''); setPortionAmount('100'); setPortionUnit('g') }
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
      <div className="catalog-filters"><label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null) }} placeholder="Buscar nome, sinônimo, categoria ou código" autoFocus aria-label="Buscar alimento no catálogo" /></label><select value={category} onChange={(event) => { setCategory(event.target.value); setSelected(null) }} aria-label="Filtrar categoria"><option value="">Todas as categorias</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Ordenar alimentos"><option value="relevance">Mais relevantes</option><option value="name">Nome</option><option value="category">Categoria</option><option value="source-code">Código da fonte</option></select></div>
      <div className="catalog-results">{results.map((food) => <button type="button" className={selected?.id === food.id ? 'active' : ''} key={food.id} onClick={() => chooseFood(food)}><span><strong>{food.foodName}</strong><small>{food.originalName || `${food.category} · ${food.preparation}`}</small><em>{food.sourceName}</em></span><span>{food.referenceAmount} {food.referenceUnit}<small>{food.sourceFoodCode ? `FDC ${food.sourceFoodCode}` : food.sourceVersion}</small></span>{selected?.id === food.id ? <Check size={15} /> : <Plus size={15} />}</button>)}{!results.length && <div className="catalog-empty"><strong>{scope === 'scientific' ? 'Catálogo científico ainda não incorporado' : 'Nenhum item encontrado'}</strong><p>{scope === 'scientific' ? 'O importador exige o arquivo oficial e a conferência real de hashes. Nenhum release foi incorporado sem essa verificação.' : 'Ajuste a busca ou os filtros do catálogo demonstrativo.'}</p></div>}</div>
      {selected && <div className="catalog-portion" aria-label="Definir porção do alimento">
        <div className="catalog-portion__header"><strong>Porção que será adicionada</strong><span>Prévia proporcional aos valores da fonte; sem recomendação automática.</span></div>
        <div className="catalog-portion__fields"><label><span>Quantidade da porção</span><input type="number" min="0.01" step="0.01" value={portionAmount} onChange={(event) => setPortionAmount(event.target.value)} aria-label="Quantidade da porção" /></label><label><span>Unidade da porção</span><select value={portionUnit} onChange={(event) => { const value = event.target.value; setPortionUnit(value); setPortionAmount(value.startsWith('measure:') ? '1' : String(selected.referenceAmount)) }} aria-label="Unidade da porção"><option value={selected.referenceUnit}>{selected.referenceUnit === 'g' ? 'Gramas (g)' : 'Mililitros (ml)'}</option>{selected.densityGPerMl && <option value={selected.referenceUnit === 'g' ? 'ml' : 'g'}>{selected.referenceUnit === 'g' ? 'Mililitros (ml)' : 'Gramas (g)'}</option>}{selected.householdMeasures.map((measure) => <option key={measure.id} value={`measure:${measure.id}`}>{measure.label} ({measure.equivalentAmount} {measure.equivalentUnit})</option>)}</select></label></div>
        <p className={portionValid ? 'catalog-portion__hint' : 'catalog-portion__hint catalog-portion__hint--error'} role={portionValid ? undefined : 'alert'}>{chosenPortionLabel}</p>
      </div>}
      {selected && <section className="catalog-composition" aria-label={`Composição de ${selected.foodName}`}><header><div><strong>{selected.foodName}</strong><span>{selected.category} · {selected.preparation}</span></div><small>Base do catálogo: {selected.referenceAmount} {selected.referenceUnit}</small></header><div>{keys.map((key) => { const datum = selected.nutrients[key]; const value = previewNutrition?.values[key]; return <article key={key}><span>{{ energyKcal: 'Energia', proteinG: 'Proteínas', carbohydrateG: 'Carboidratos', fatG: 'Lipídios', fiberG: 'Fibras', sodiumMg: 'Sódio' }[key]}</span><strong>{!portionValid ? '—' : datum.status === 'known' && value !== undefined ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${{ energyKcal: 'kcal', proteinG: 'g', carbohydrateG: 'g', fatG: 'g', fiberG: 'g', sodiumMg: 'mg' }[key]}` : datum.status === 'not-analyzed' ? 'Não analisado' : 'Indisponível'}</strong></article>})}</div>{selected.householdMeasures.length > 0 && <p>Medidas documentadas: {selected.householdMeasures.map((measure) => `${measure.label} = ${measure.equivalentAmount.toLocaleString('pt-BR')} ${measure.equivalentUnit}`).join('; ')}.</p>}<footer><span>{selected.sourceName} · {selected.sourceVersion}</span><small>{selected.sourceFoodCode ? `Código ${selected.sourceFoodCode} · ` : ''}{selected.sourceLicense}</small></footer></section>}
      {selected && <div className="catalog-confirm"><div><strong>Seleção revisável</strong><span>A composição e a porção escolhida serão registradas nesta versão do plano.</span><small>Atualizações futuras do catálogo não alterarão o histórico.</small></div><button type="button" className="button button--primary" disabled={!portionValid || !portion} onClick={() => { if (!portionValid || !portion) return; onAdd(createCatalogFoodItem(selected, newId(), portion)); resetPicker() }}>{actionLabel}</button></div>}
      <footer><span>{scope === 'scientific' ? `${scientificFoodCatalog.length} alimentos científicos auditados${scientificCatalogMetadata.contentSha256 ? ' · integridade registrada' : ''}` : `${demoFoodCatalog.length} itens fictícios, exclusivos da demonstração`}</span><button type="button" className="text-button" onClick={() => setCustom(true)}>Cadastrar alimento próprio</button></footer>
    </>}
  </section>
}
