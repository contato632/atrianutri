# Integração das Etapas 21–23

## Estado

Integração preparada em 12 de novembro de 2026 na branch `integration/atrianutri-etapas-21-23`, criada diretamente de `origin/main` no commit `73eeb8eaf5cdc9bfe2c98f4ac697a36396dafdd1`.

A Pull Request deve permanecer em rascunho. Não houve merge na `main`, deploy, alteração da Hostinger, chamada à Anthropic ou operação no Supabase remoto.

## Histórico preservado

As três etapas já formavam uma cadeia linear, sem divergência:

1. `df2a3cc07fb55c0c3b087ea186f941def7411bb6` — Etapa 21, UX e produtividade;
2. `1788dffc029ab4125c5b26d75b8abb5cb8db10d1` — Etapa 22, anamnese nutricional;
3. `03d8de2b80531d9d4d43ed216d14341f1ed06425` — Etapa 23, catálogo científico e editor.

Foram criados merges explícitos, sem squash ou reescrita:

- `d9131bb9e4f3a3df82715b02ae3dca31358d5f52` — integração da Etapa 21;
- `9c0ac0700d4f8361a3a1de48f442576f6829fc37` — integração da Etapa 22;
- `59d2dc5f43ee1016123968479a37da7796e024e7` — integração da Etapa 23.

A árvore após os merges foi comparada com o commit final da Etapa 23 e era idêntica antes da correção específica de integração descrita abaixo.

## Sobreposições e conflitos

Não houve conflitos textuais durante os merges. As Etapas 21 e 22 modificavam em comum:

- `src/pages/NutritionIntelligencePage.tsx`;
- `src/pages/PatientDetailPage.tsx`;
- `src/premium.css`;
- `src/state/WorkspaceContext.tsx`.

Como a Etapa 22 descendia da 21, ela já continha a composição correta desses arquivos. A Etapa 23 não sobrepunha arquivos das duas etapas anteriores.

### Correção funcional da integração

A auditoria conjunta identificou que a troca de paciente na barra de jornada alterava o contexto global, mas não atualizava a rota quando o profissional estava em `/pacientes/:id`. Isso podia deixar o prontuário anterior visível com outro paciente marcado como contexto.

`PatientJourneyBar` passou a:

- atualizar contexto e rota juntos ao trocar o paciente dentro do prontuário;
- retornar à lista de pacientes ao encerrar o contexto dentro do prontuário.

O fluxo automatizado comprova que um rascunho de anamnese criado para Ana não aparece ao trocar para Rafael e reaparece ao retornar para Ana.

## Compatibilidade entre módulos

### Jornada profissional

A seleção do paciente permanece consistente entre cadastro, prontuário, avaliações, plano alimentar, Intelligence, documentos e agenda. A sidebar premium, barra contextual, navegação mobile e identidade visual do redesign foram preservadas.

### Anamnese

O prontuário oferece as seis seções, rascunhos, revisão final, versões históricas, origem por resposta e observações privadas. Somente versões concluídas entram na linha do tempo do Intelligence. Notas privadas não são incluídas em documentos por padrão.

### Catálogo e planejamento

O editor mantém pesquisa, composição, proveniência, unidades, medidas específicas, substituição explícita, totais por refeição e plano, snapshots e PDF. O catálogo científico permanece vazio e separado dos seis itens fictícios da demonstração.

### Documentos

A prévia e o PDF continuam locais. Informações nutricionais são opcionais, identificam cobertura parcial e preservam fonte, versão, licença e código presentes no snapshot do plano.

## Segurança

- `.env.example` mantém `VITE_DATA_MODE=demo` e `VITE_REAL_DATA_APPROVED=false`;
- nenhuma chave administrativa ou credencial foi adicionada;
- Auth, MFA, RLS e isolamento organizacional existentes foram preservados;
- IA real continua bloqueada e nenhuma chamada à Anthropic foi feita;
- nenhum dado clínico real foi usado nos testes;
- nenhuma migration foi aplicada remotamente;
- nenhuma configuração da Hostinger foi alterada.

## Testes executados

- TypeScript/Vite build: aprovado;
- Vitest: 26 arquivos, **201 testes aprovados**;
- Playwright consolidado: **31 fluxos aprovados**;
- fluxo cruzado Etapas 21–23: aprovado;
- desktop e mobile: aprovados nos fluxos direcionados;
- catálogo, cálculos, snapshots, versionamento e PDF: aprovados;
- navegação, troca de paciente e isolamento do rascunho: aprovados;
- verificação de segredos e `git diff --check`: executadas antes do push.

## PostgreSQL e pgTAP

Há 12 migrations locais e oito arquivos de testes PostgreSQL. A migration `20261111140000_structured_nutrition_anamnesis.sql` permanece versionada e não aplicada remotamente.

Os sete testes de `structured_anamnesis_rls_test.sql` **não foram executados**. O Docker local está saudável, porém o executor possui apenas cerca de 1,2 GB livres e não contém a imagem oficial Supabase/PostgreSQL exigida. A tentativa anterior de extrair essa imagem falhou por falta de espaço. Não foi feita limpeza destrutiva de imagens compartilhadas e PostgreSQL genérico não foi tratado como substituto da pilha oficial.

Antes de homologação remota, é obrigatório executar a sequência completa de migrations e todos os testes pgTAP em uma pilha Supabase descartável com espaço suficiente.

## Catálogo científico

Alimentos científicos incorporados: **0**.

O pipeline exige arquivo oficial, licença revisada e hashes verificáveis. O canal oficial USDA retornou HTTP 403 no executor. Nenhuma cópia secundária, dado inventado ou alimento demonstrativo foi promovido a científico.

## Pull Request

- Base: `main`;
- Head: `integration/atrianutri-etapas-21-23`;
- Estado pretendido: rascunho, sem merge automático;
- URL: será registrada em commit documental após a criação da PR.

O merge futuro na `main` pode iniciar publicação automática pela Hostinger e depende de revisão conjunta explícita.
