# Etapa 23 — Catálogo Científico de Alimentos e Editor Nutricional Avançado

## Resultado da etapa

A infraestrutura do catálogo foi reforçada e integrada ao editor profissional, mas foram incorporados **0 alimentos científicos**.

O canal oficial do USDA FoodData Central (`https://fdc.nal.usda.gov/`) foi consultado em 11 de novembro de 2026 e o proxy do executor recusou a conexão com HTTP 403. Não há arquivos oficiais USDA, TACO ou TBCA no repositório. Nenhuma cópia secundária, valor manual ou item demonstrativo foi promovido a dado científico.

O catálogo demonstrativo continua com seis itens fictícios, visualmente identificados e disponível apenas no modo demonstração. Ele serve para exercitar editor, cálculos, snapshots e documentos; não deve orientar conduta clínica.

## Auditoria do que já existia

As Etapas 13 e 14 já forneciam componentes reutilizáveis:

- contrato de composição e snapshots em `src/domain/models.ts` e `src/domain/foodCatalog.ts`;
- importador CSV do USDA em `scripts/import-usda-fooddata.mjs`;
- artefato científico isolado em `src/data/scientific-food-catalog.json`;
- busca e validação em `src/domain/scientificCatalog.ts`;
- cálculo determinístico em `src/domain/nutritionCalculation.ts`;
- seletor, editor de porções, metas manuais e substituições no editor de planos;
- snapshots imutáveis em cada versão do plano;
- seção nutricional opcional no PDF local.

Essas estruturas foram mantidas e aprimoradas, sem reimplementação paralela.

## Fontes e situação jurídica

| Fonte | Situação verificada nesta etapa | Decisão |
| --- | --- | --- |
| USDA FoodData Central | O projeto já declara `Foundation Foods` e `CC0-1.0`, mas o portal e o artefato oficial não puderam ser acessados novamente por bloqueio HTTP 403. Sem arquivo, release e checksum conferíveis nesta execução | Pipeline preservado como fonte elegível; nenhum registro importado |
| TACO / NEPA-Unicamp | Não há arquivo oficial nem licença explícita de redistribuição comercial arquivada no projeto | Não incorporada |
| TBCA / USP | Não há exportação oficial nem termos de redistribuição comercial arquivados no projeto; scraping não foi realizado | Não incorporada |

Antes de incorporar qualquer release, devem ser arquivados os termos aplicáveis, a URL oficial, a edição, a data da consulta e a revisão jurídica para redistribuição no produto.

## Importação verificável

O importador agora exige simultaneamente:

1. diretório descompactado com `food.csv`, `food_nutrient.csv` e `nutrient.csv`;
2. arquivo compactado oficial original;
3. manifesto de seleção revisado;
4. URL oficial, release, data, conjunto `Foundation Foods` e licença `CC0-1.0`;
5. SHA-256 declarado e conferido contra os bytes reais do arquivo original.

O processo interrompe em caso de:

- hash divergente;
- códigos FDC repetidos no manifesto ou arquivo de alimentos;
- definições ou valores de nutrientes duplicados;
- unidade incompatível;
- valor negativo ou não numérico;
- tradução, categoria, preparo ou descrição original ausentes;
- sinônimos inválidos;
- medidas caseiras incompletas, repetidas ou sem equivalência válida.

A saída determinística registra:

- SHA-256 do arquivo oficial;
- SHA-256 do manifesto revisado;
- SHA-256 de cada CSV;
- SHA-256 do conteúdo normalizado incorporado;
- quantidade selecionada e importada;
- total de linhas lidas por arquivo;
- nutrientes conhecidos e indisponíveis.

Nutriente ausente permanece `unavailable`; zero só é registrado quando a fonte informa zero.

Comando preparado:

```sh
npm run catalog:import:usda -- \
  --input /caminho/release-oficial-descompactado \
  --archive /caminho/arquivo-oficial-original.zip \
  --selection data/catalog/usda-selection.json \
  --output src/data/scientific-food-catalog.json
```

O manifesto atual continua incompleto e o comando deve recusá-lo.

## Busca e editor profissional

O seletor agora oferece:

- busca por nome traduzido, nome original, sinônimos revisados, categoria, preparo e código da fonte;
- ordenação por relevância, nome, categoria ou código;
- origem visível em cada resultado;
- composição completa antes da inclusão, distinguindo conhecido, não analisado e indisponível;
- medidas caseiras específicas do alimento, quando documentadas;
- licença, versão e código da fonte;
- confirmação antes de copiar o alimento para o plano;
- substituição por qualquer item do catálogo somente após confirmação profissional;
- cadastro profissional separado do catálogo científico.

A substituição registra alimento anterior, novo alimento, horário e decisão explícita. Ela não representa equivalência nutricional, clínica ou alergênica automática.

## Porções e cálculos

- Gramas e mililitros só são intercambiados quando o snapshot possui densidade documentada.
- Medidas caseiras usam a equivalência específica daquele alimento.
- Cálculos são proporcionais à porção e preservam nutrientes ausentes.
- Totais são mostrados por alimento, refeição e plano.
- Refeições e nutrientes incompletos são marcados como parciais.
- Metas são exclusivamente manuais e não recebem classificação clínica automática.

## Histórico e documentos

A composição, origem, licença, versão, código e medidas ficam copiadas no snapshot da versão do plano. Alterações futuras do catálogo não modificam versões históricas.

A seção nutricional do PDF continua opcional. Quando selecionada, apresenta cobertura completa, parcial ou indisponível e agora registra também licença e código da fonte. A geração permanece integralmente local.

## Segurança

O catálogo é um artefato estático separado dos dados clínicos. Nenhum dado de paciente é enviado ao USDA ou a outro serviço. Não foi criada migration nesta etapa e nenhuma alteração foi realizada no Supabase remoto, Hostinger ou serviços de IA.

## Testes

Foram executados testes para:

- CSV, aspas e vírgulas;
- conferência real do hash do arquivo oficial;
- relatório e hashes determinísticos;
- duplicatas, unidades e valores ausentes;
- medidas caseiras e densidades;
- busca por sinônimos e relevância;
- cálculos e totais parciais;
- snapshots imutáveis e versionamento;
- composição, inclusão e substituição no editor;
- rastreabilidade no documento PDF;
- responsividade em 390 px.

Resultados finais:

- Vitest: 26 arquivos e 201 testes aprovados;
- TypeScript/Vite build: aprovado;
- Playwright novo da Etapa 23: 2 fluxos aprovados;
- Playwright de regressão para catálogo, editor, PDF e mobile: 5 fluxos aprovados;
- `git diff --check`: aprovado antes do commit.

## Pendências para catálogo científico real

1. Liberar acesso controlado ao domínio oficial do FoodData Central ou fornecer o arquivo oficial por canal autorizado.
2. Guardar os termos/licença e o checksum do release selecionado.
3. Revisar a seleção, traduções, preparos, sinônimos, densidades e medidas com nutricionista responsável.
4. Executar o importador e revisar integralmente o relatório e os alertas.
5. Repetir Vitest, Playwright e revisão documental com os registros reais.
6. Obter parecer jurídico antes de qualquer uso de TACO ou TBCA.

Até essas pendências serem concluídas, a aplicação não declara possuir catálogo científico operacional e a persistência real continua bloqueada.
