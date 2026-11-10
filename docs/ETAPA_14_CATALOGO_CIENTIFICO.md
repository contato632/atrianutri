# Etapa 14 — Catálogo Alimentar Científico e Rastreabilidade

Trabalho local realizado em 10 de novembro de 2026 sobre o commit preservado `aa7439bf0c2dcff3c69f5b6dc13e38593b0ceada`. Nenhuma migration remota, publicação, push ou ativação de dados reais foi executada.

## Resultado e condição de conclusão

Foram incorporados **0 alimentos científicos**. A arquitetura, o importador, as validações, a interface e os testes ficaram preparados, mas o catálogo clínico não é declarado como concluído.

O executor não conseguiu acessar os artefatos oficiais necessários para conferir release, conteúdo e checksum:

- acesso HTTP ao portal FoodData Central: bloqueado pelo proxy com HTTP 403;
- acesso pelo navegador compartilhado: o ambiente não conseguiu ler os requisitos da página;
- nenhum arquivo oficial USDA, TACO, TBCA ou IBGE já existia no repositório.

O escopo proíbe usar mirrors não verificáveis ou importar dados com licença comercial incerta. Por isso, nenhum valor foi copiado de fonte secundária e nenhum registro fictício foi promovido a científico.

## Investigação das fontes

| Fonte | Origem e edição | Formatos conhecidos | Licença/restrição considerada | Decisão |
| --- | --- | --- | --- | --- |
| USDA FoodData Central | Agricultural Research Service, Estados Unidos; releases versionados | Downloads CSV/JSON e API | O escopo informa CC0. A integração comercial é compatível em princípio, mas release e arquivos oficiais ainda precisam ser obtidos e conferidos | Fonte preparada pelo importador; 0 registros incorporados |
| TACO | NEPA/UNICAMP; 4ª edição revisada e ampliada é a edição pública historicamente referenciada | Publicações e planilhas distribuídas pela instituição | Não foi possível confirmar licença explícita de redistribuição comercial e de produção de base derivada | Não importada |
| TBCA | USP/BRASILFOODS; base atualizada no portal | Consulta web e exportações oferecidas pelo portal conforme suas condições | Scraping proibido pelo escopo; autorização comercial e termos de redistribuição não verificados | Não acessada nem importada |
| IBGE/POF | IBGE, Pesquisa de Orçamentos Familiares; tabelas de composição ligadas à POF 2008–2009 | Publicações e tabelas auxiliares | Autoria oficial não equivale automaticamente a autorização para incorporar e redistribuir a base em software comercial; condições não verificadas | Não importada |

Antes de uso clínico, a revisão jurídica deve guardar uma cópia dos termos aplicáveis, URL oficial, data de consulta, edição, atribuição exigida e autorização para redistribuição em produto comercial.

## Arquitetura implementada

### Artefato científico separado

`src/data/scientific-food-catalog.json` é o único artefato carregado como catálogo científico. Ele contém metadados de fonte e uma lista atualmente vazia. A aplicação valida esse arquivo durante a inicialização e interrompe o carregamento se houver erro de integridade.

Os seis itens da Etapa 13 continuam em `demoFoodCatalog`, com `catalogType: demonstration` e `demonstrative: true`. Eles aparecem somente no modo demonstração e nunca são unidos ao catálogo científico. Alimentos cadastrados pelo profissional recebem `catalogType: professional`.

### Importador reproduzível

`scripts/import-usda-fooddata.mjs` processa arquivos oficiais descompactados do FoodData Central:

- `food.csv`;
- `food_nutrient.csv`;
- `nutrient.csv`.

O manifesto revisado `data/catalog/usda-selection.json` deve informar:

- release e data oficial;
- URL em `https://fdc.nal.usda.gov/`;
- SHA-256 do arquivo baixado;
- conjunto `Foundation Foods` e licença `CC0-1.0`;
- códigos FDC escolhidos;
- nome em português revisado;
- categoria e estado de preparo em português;
- termos de busca e medidas específicas revisadas.

O importador calcula SHA-256 de cada CSV usado e grava esses checksums no resultado. A saída é ordenada pelo código FDC e não contém horário dinâmico, permitindo reprodução e comparação de diffs.

Comando preparado:

```sh
npm run catalog:import:usda -- \
  --input /caminho/release-oficial-descompactado \
  --selection data/catalog/usda-selection.json \
  --output src/data/scientific-food-catalog.json
```

O manifesto está intencionalmente incompleto e o comando recusa a importação até que release, URL, checksum e seleção revisada sejam preenchidos.

## Mapeamento nutricional

O pipeline usa composição por 100 g e os identificadores de nutrientes FoodData Central preparados para:

- energia em kcal;
- proteínas em g;
- carboidratos em g;
- gorduras totais em g;
- fibras em g;
- sódio em mg.

Unidade incompatível causa erro. Nutriente sem registro fica `unavailable`; ele nunca vira zero. Valores científicos não são corrigidos automaticamente.

Cada snapshot destinado ao plano preserva:

- nome traduzido e nome original;
- categoria e preparo;
- código FDC;
- fonte, release, data e licença;
- composição e estados de ausência;
- quantidade de referência;
- medidas e conversões revisadas.

Isso mantém os cálculos históricos mesmo quando um catálogo futuro for atualizado.

## Validações de qualidade

`validateScientificCatalog` detecta:

- licença ou fonte incompatível;
- ausência de URL oficial, data ou SHA-256;
- valores negativos e não numéricos;
- unidades ou quantidade de referência inconsistentes;
- códigos FDC inválidos ou duplicados;
- mistura entre científico e demonstração;
- tradução, categoria ou preparo ausentes;
- duplicidade de nome + preparo;
- medidas caseiras inválidas;
- valores extremos que exigem revisão.

Valores extremos geram alerta e permanecem inalterados. Erros impedem o catálogo de ser carregado.

## Interface

O seletor de alimentos agora oferece:

- abas separadas **Científico** e **Demonstração**;
- contagem real de registros em cada origem;
- busca por nome em português, nome original, categoria, preparo e código;
- filtro por categoria;
- ordenação por nome, categoria ou código da fonte;
- fonte, versão, licença e quantidade de referência;
- confirmação explícita antes da inclusão;
- estado vazio explicando por que o catálogo científico ainda não foi incorporado;
- layout responsivo sem rolagem horizontal.

A pesquisa demonstrativa continua funcional para validar o editor, cálculos, substituições e PDF. Em modo Supabase, os itens fictícios não são oferecidos.

## Compatibilidade e documentos

- Planos antigos continuam legíveis e editáveis.
- Snapshots da Etapa 13 já suportam os novos campos de rastreabilidade.
- Alimentos personalizados continuam separados do catálogo científico.
- Cálculos determinísticos, totais parciais, metas manuais e substituições confirmadas foram preservados.
- O PDF continua usando o snapshot da versão selecionada e mostra a fonte quando a seção nutricional é escolhida.
- A migration `20261109230000_meal_plan_nutrition_metadata.sql` foi preservada sem alteração e não foi aplicada remotamente.

## Testes executados

- `npm run build`: TypeScript e Vite aprovados.
- Vitest completo: **18 arquivos, 123 testes aprovados**.
- Playwright direcionado: **5 fluxos aprovados** em Chromium.
- `git diff --check`: executado antes do commit.

Cobertura direcionada:

- parser CSV com aspas e vírgulas;
- importação rastreável e checksums;
- rejeição de licença/manifesto incompletos e unidades incompatíveis;
- nutrientes ausentes;
- valores negativos e extremos;
- códigos e alimentos duplicados;
- pesquisa por tradução/nome original, filtros e ordenação;
- separação científico/demonstração;
- cálculo por porção, substituições e versionamento;
- PDF e compatibilidade com planos anteriores;
- desktop e celular.

## Pendências

1. Obter um release oficial USDA por canal permitido e registrar checksum do arquivo antes de descompactar.
2. Revisar uma seleção pequena de `Foundation Foods`, priorizando itens úteis ao mercado brasileiro sem apresentá-los como análises brasileiras.
3. Revisar traduções, categorias, preparos e medidas com nutricionista responsável.
4. Executar importação, revisar todos os alertas e repetir testes com os registros reais.
5. Obter parecer jurídico específico antes de qualquer integração TACO, TBCA ou IBGE.
6. Homologar a migration da Etapa 13 e o catálogo em ambiente Supabase descartável antes de persistência remota.

Enquanto esses itens estiverem pendentes, o AtriaNutri não deve apresentar o catálogo como clínico ou científico operacional.
