# AtriaNutri — Redesign Premium

## Escopo e base

O redesign foi desenvolvido na branch `codex/atrianutri-premium-redesign`, criada diretamente do commit `e7f84ffaf1330c1f4458d2f7ffb04ac95886f632` da branch de integração das Etapas 17–20.

A intervenção é predominantemente visual. Não houve alteração de migrations, banco, autenticação, RLS, regras clínicas, cálculos nutricionais, PDFs, contratos de IA ou configuração de hospedagem.

## Design system

A camada visual compartilhada foi isolada em `src/premium.css` e carregada depois dos estilos históricos. Isso permite consolidar o novo sistema sem duplicar componentes funcionais nem reescrever páginas aprovadas.

### Tokens principais

- identidade: `--brand-950` a `--brand-500`, `--aqua-500`, `--aqua-400`, `--aqua-100` e `--aqua-50`;
- superfícies: `--canvas`, `--surface`, `--surface-raised` e `--surface-muted`;
- conteúdo: `--navy`, `--ink`, `--muted`, `--line` e `--line-strong`;
- estados: `--success`, `--warning` e `--danger`;
- raios: `--radius-sm`, `--radius-md`, `--radius-lg` e `--radius-xl`;
- profundidade: `--shadow-sm`, `--shadow` e `--shadow-lg`;
- controles: `--control-height`;
- tipografia: `--font-display` e `--font-body`.

### Primitives consolidadas

Os componentes existentes continuam sendo a fonte funcional, agora padronizados por classes compartilhadas:

- `.panel`, `.panel__header`, `.metric-card` e `.module-card` para superfícies;
- `.button`, `.button--primary`, `.button--soft`, `.button--ghost` e `.icon-button` para ações;
- `.field`, `.search-field`, `.select-field` e controles de filtros para formulários;
- `.tag`, `.status`, `.avatar`, `.eyebrow` e `.empty-state` para indicadores;
- `.welcome-row`, `.section-intro` e `.agenda-heading` para hierarquia editorial.

## Componentes alterados

- `src/components/AppShell.tsx`: estados ARIA do menu, associação entre acionador e drawer, `role="dialog"` e `inert` no drawer fechado;
- `src/main.tsx`: importação da camada premium após os estilos funcionais existentes;
- `src/components/NutritionEvaluationForm.tsx`: data civil atual de `America/Bahia` no campo de avaliação;
- `src/components/DietaryRecallForm.tsx`: data civil atual de `America/Bahia` no recordatório;
- `src/domain/validation.ts`: comparação de datas civis, sem rejeitar incorretamente o dia atual antes do meio-dia;
- `src/domain/validation.test.ts`: cobertura de hoje e de data futura;
- `e2e/premium-redesign.spec.ts`: contratos visuais e responsivos automatizados.

## Páginas padronizadas

- Início: indicadores com altura consistente, ações, agenda, pendências e evoluções;
- Pacientes: busca, filtro, linhas, estados e apresentação responsiva;
- Agenda: toolbar, navegação, alternância de visão, eventos e grade semanal;
- Avaliações: seleção de paciente, métricas, gráfico, histórico e avisos clínicos;
- Planos alimentares: contexto do plano, refeições, publicação, composição e versões;
- Documentos: tipos de documento, editor, formulários, seleção ativa e prévia;
- Gestão e Financeiro: módulos, serviços, indicadores, tabelas e ações;
- Intelligence: tendências, insights, linha do tempo, assistente clínico e homologação sintética;
- prontuário, formulários, modais, estados vazios e portal continuam usando as mesmas primitives visuais.

## Sidebar e shell

A sidebar usa azul-marinho profundo com sobreposição petróleo, iluminação turquesa localizada, curvas translúcidas em CSS e profundidade controlada. As camadas são pseudo-elementos sem interação e não interceptam cliques.

O item ativo combina borda translúcida, marca lateral turquesa e brilho discreto. A versão recolhida preserva símbolo, ícones, foco e estado ativo. O drawer móvel reutiliza a mesma identidade e é removido da ordem de foco quando fechado.

O conteúdo principal utiliza gradientes radiais muito suaves atrás das superfícies. O header superior é translúcido, compacto e permanece legível sobre o fundo.

## Responsividade

Foram verificadas as larguras de 360, 390, 768, 1024 e 1440 pixels.

- a navegação inferior usa fluxo horizontal interno para os oito módulos, sem ampliar o documento;
- o drawer possui largura útil de 310 px em 390 px, mantendo rótulos e área de toque;
- formulários, métricas, tabelas e cartões são recompostos em uma coluna quando necessário;
- a agenda semanal usa explicitamente uma coluna de horários mais sete colunas de dias;
- domingo não quebra para uma linha isolada;
- a visualização semanal pode rolar internamente em telas estreitas sem causar overflow na página;
- os estados recolhido e expandido da sidebar foram inspecionados.

## Acessibilidade e desempenho

- foco visível com contraste turquesa;
- controles do menu com `aria-expanded` e `aria-controls`;
- drawer com nome acessível, modalidade e estado `inert` quando fechado;
- suporte a `prefers-reduced-motion`;
- áreas de toque móveis ampliadas;
- ausência de imagens decorativas ou dependências externas;
- efeitos construídos com gradientes e pseudo-elementos estáticos;
- filtros limitados às superfícies que exigem separação visual.

## Problemas encontrados e corrigidos

1. O domingo quebrava para uma segunda linha porque uma regra antiga de sete colunas sobrescrevia a grade que também contém a coluna de horários. A nova regra define `gutter + 7 dias` com especificidade explícita.
2. A navegação mobile tinha oito destinos em uma grade fixa de sete colunas. Ela agora usa colunas automáticas com rolagem interna, sem overflow do documento.
3. O drawer fechado mantinha links fora da tela na ordem de foco. O container agora recebe `inert` enquanto fechado.
4. A validação de datas rejeitava o dia atual antes do meio-dia ao comparar `hoje às 12:00` com o instante atual. A regra continua proibindo datas futuras, mas compara datas civis de `America/Bahia`.
5. Estados de foco, controles, sombras, bordas e raios divergiam entre módulos. A camada premium centraliza esses padrões.

## Testes executados

- `npm test`: 25 arquivos e 183 testes Vitest aprovados;
- `npm run build`: TypeScript e build Vite aprovados;
- Playwright direcionado: 35 fluxos aprovados;
- matriz automatizada sem overflow nas larguras 360, 390, 768, 1024 e 1440;
- menu expandido e recolhido, drawer mobile, foco visível e movimento reduzido aprovados;
- agenda semanal com sete dias alinhados aprovada;
- documentos, PDF, planos, avaliações, financeiro e formulários demonstrativos preservados;
- Intelligence, assistente simulado e homologação sintética preservados, sem chamada à Anthropic.

Os avisos de build sobre comentários `@__PURE__` em arquivos internos do `zod` são informativos do Rollup e não interrompem a compilação.

## Auditoria visual

Foram inspecionados localmente, em execução real, Início, Pacientes, Agenda, Avaliações, Planos alimentares, Documentos após carregamento assíncrono, Gestão, Intelligence, Homologação, sidebar recolhida e drawer mobile.

A inspeção confirmou uniformidade de cores, tipografia, superfícies, ícones, botões, controles, estados ativos e espaçamentos. A prévia de documentos e o conteúdo clínico não foram alterados pelo redesign.

## Pendências

- Nenhuma pendência técnica bloqueante foi identificada no escopo visual.
- O aceite estético final das referências permanece uma decisão de produto, sem exigir mudança funcional.
- A branch não foi publicada, mesclada ou implantada nesta etapa.
