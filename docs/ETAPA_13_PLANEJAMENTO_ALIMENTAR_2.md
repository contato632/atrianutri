# Etapa 13 — Planejamento Alimentar Profissional 2.0

Implementação local concluída em 10 de novembro de 2026 sobre o commit preservado `19f5a8d2f8a04aab2c8ead47dc3e250ec39dbac8`. Nenhuma migration foi aplicada ao Supabase remoto, nenhum push ou deploy foi executado e dados reais continuam bloqueados.

## Arquitetura

As regras nutricionais foram separadas da interface React:

- `domain/foodCatalog.ts`: contrato e pesquisa do catálogo, snapshots e conjunto demonstrativo.
- `domain/nutritionCalculation.ts`: resolução de porções, conversões autorizadas, totais, completude e percentuais energéticos.
- `domain/mealPlanning.ts`: criação de itens do catálogo, comparação e aprovação explícita de substituições.
- `components/FoodCatalogPicker.tsx`: pesquisa e cadastro de alimento personalizado.
- `components/PlanFoodRow.tsx`: edição de porção, ordenação e substituições.
- `components/PlanNutritionPanel.tsx`: totais, distribuição por refeição, macronutrientes e metas manuais.
- `pages/MealPlansPage.tsx`: orquestra paciente, plano, refeições, versões e salvamento.

O catálogo não recebe dados clínicos. O plano continua delimitado pelo repositório da organização ativa e pelas políticas clínicas existentes. Nenhum dado é persistido em `localStorage`, `sessionStorage` ou IndexedDB.

## Fontes nutricionais e licenças

TACO e TBCA foram consideradas como fontes brasileiras prioritárias. Não foi encontrada no repositório uma licença de redistribuição que autorizasse incorporar integralmente essas bases. A tentativa de consultar a página oficial da TBCA durante esta etapa foi bloqueada pela política de rede do executor com HTTP 403. Por isso, nenhuma tabela TACO/TBCA foi copiada, raspada ou apresentada como licenciada.

Esta entrega utiliza seis alimentos fictícios no **Catálogo demonstrativo AtriaNutri 1.0**. Cada snapshot contém `demonstrative: true` e a advertência “não utilizar como referência científica ou clínica”. A interface repete essa condição no catálogo, no editor e no painel. Os números existem apenas para testar cálculos, conversões, versionamento e experiência do usuário.

Uma futura importação científica depende de:

1. confirmação documental de licença e atribuição;
2. mapeamento de versão, unidades, estado de preparo e códigos da fonte;
3. processo reproduzível de importação e validação;
4. revisão profissional e jurídica antes da distribuição.

## Modelo e snapshots

Cada alimento estruturado armazena na versão do plano:

- identificação e categoria;
- estado de preparo;
- fonte, versão, licença e indicador demonstrativo;
- quantidade e unidade de referência;
- nutrientes com estado `known`, `not-analyzed` ou `unavailable`;
- densidade, quando cadastrada;
- medidas caseiras específicas daquele alimento;
- porção efetivamente selecionada;
- substituição aprovada, quando houver.

Assim, alterações futuras do catálogo não recalculam silenciosamente versões antigas. Alimentos dos planos anteriores continuam compatíveis e aparecem como “composição não informada”, sem números inventados.

## Regras de cálculo

Para composição na mesma unidade da referência:

`valor da porção = valor da referência × quantidade selecionada ÷ quantidade de referência`

Regras adicionais:

- zero conhecido participa do total como zero;
- `not-analyzed` e `unavailable` nunca são convertidos em zero;
- totais ficam `partial` quando apenas parte dos itens possui o nutriente;
- o painel mostra `unavailable` quando nenhum item possui o dado;
- percentuais energéticos usam 4 kcal/g para proteínas e carboidratos e 9 kcal/g para gorduras;
- percentuais só aparecem quando os três macronutrientes estão completos;
- metas são digitadas manualmente e não recebem classificação de adequação.

São calculados energia, proteínas, carboidratos, gorduras, fibras e sódio por alimento, refeição e plano.

## Conversões e medidas caseiras

- Gramas e mililitros são usados diretamente apenas quando correspondem à unidade da fonte.
- Conversão `ml ↔ g` exige densidade específica cadastrada no snapshot.
- Medida caseira exige equivalência vinculada ao alimento e à forma de preparo.
- Colher, xícara, unidade, concha e outras medidas não possuem conversão universal.
- Uma medida ausente ou incompatível bloqueia o cálculo daquele item e explica o motivo.
- Alimentos personalizados aceitam porção em g ou ml e composição opcional explicitamente informada por 100 g ou 100 ml.

## Substituições

As alternativas são relações previamente cadastradas no catálogo. A comparação atual mantém a mesma quantidade base em g ou ml e exibe diferenças de energia e proteína, fonte e critério. A interface afirma que isso não representa equivalência clínica nem avaliação de alergias, intolerâncias ou condições de saúde.

Consultar alternativas não modifica o plano. A troca ocorre somente no botão **Confirmar substituição** e grava alimento original, substituto, critério e horário da aprovação no snapshot da versão.

## Versionamento e persistência

O mecanismo existente de versões imutáveis foi preservado. Cada salvamento cria uma nova versão contendo refeições, alimentos, porções, orientações, snapshots nutricionais e substituições aprovadas.

Foi criada, mas não aplicada remotamente, a migration:

`20261109230000_meal_plan_nutrition_metadata.sql`

Ela adiciona `nutrition_targets` ao snapshot imutável e cria RPCs `create_meal_plan_draft_v2` e `save_meal_plan_version_v2`. As RPCs validam chaves permitidas, números positivos, acesso clínico por organização e concorrência pela versão esperada. A sequência remota candidata passa a terminar com essa migration, depois de `20261109180000_finance_reversal_ambiguity_fix.sql`, somente mediante autorização futura.

## PDF do plano alimentar

O PDF preserva a identidade profissional da Etapa 12, paciente, data, versão, horários, alimentos, quantidades, medidas validadas e orientações. A nova seção **Totais nutricionais calculados** fica desmarcada por padrão e depende de escolha explícita do profissional.

Quando selecionada, inclui totais disponíveis, cobertura completa/parcial/indisponível, distribuição por refeição, fontes registradas e limites dos dados. A geração permanece local e o download continua bloqueado até corresponder à prévia atual.

## Testes executados

- `npm run build`: TypeScript e Vite aprovados.
- Vitest direcionado: 5 arquivos, 38 testes aprovados.
- Playwright direcionado: 4 fluxos aprovados em Chromium.
- PostgreSQL 17 descartável: migration criada com sucesso; chave desconhecida e meta negativa rejeitadas; meta válida salva e lida no snapshot; contêiner removido ao final.
- `git diff --check`: aprovado.

Os testes cobrem proporcionalidade, conversões válidas e inválidas, densidade, zero versus ausência, totais por refeição/plano, percentuais de macronutrientes, alimento personalizado, substituição sem alteração automática, confirmação explícita, preservação histórica, contrato Supabase, planos legados, PDF, desktop e celular sem rolagem horizontal.

## Procedimentos não executados

- A pilha oficial Supabase local não iniciou porque o proxy bloqueou `public.ecr.aws` ao baixar `supabase/postgres:17.11.0.011` com HTTP 403. Portanto, o pgTAP atualizado foi preparado, mas não é declarado como executado nesta etapa.
- Nenhuma migration foi aplicada ao projeto remoto.
- Nenhuma base TACO/TBCA foi importada.
- Nenhum teste utilizou paciente ou informação clínica real.

## Limitações conhecidas e pendências

- O catálogo atual é exclusivamente demonstrativo e não serve para uso científico ou prescrição real.
- Micronutrientes adicionais dependem da fonte científica futura e do mapeamento de unidades.
- O catálogo persistente e medidas profissionais próprias exigirão tabelas, RLS e auditoria específicos após definição de licença e governança.
- A migration nova precisa ser executada novamente na pilha oficial Supabase descartável, junto ao pgTAP completo, antes de qualquer aplicação remota.
- A homologação remota continua dependente de backup/restauração, duas organizações fictícias, Auth/MFA, RLS e autorização separada.
- `VITE_REAL_DATA_APPROVED` deve permanecer desabilitado.

## Critério operacional alcançado

No modo demonstração, o nutricionista consegue abrir ou criar plano, adicionar e reordenar refeições, pesquisar alimentos, informar porções, usar medidas específicas, cadastrar alimento próprio, revisar totais parciais, definir metas manuais, comparar e confirmar substituições, salvar nova versão e gerar o PDF da versão escolhida. Nenhuma dessas ações produz prescrição automática.
