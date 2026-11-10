# AtriaNutri — Etapa 05: diário alimentar e hábitos

Entrega desenvolvida na PR #1, sem merge, deploy, publicação ou alteração do Supabase remoto.

## Funcionalidades

- Diário alimentar dentro do prontuário, com filtros por período e refeição, agrupamento diário, detalhes expansíveis, origem do registro e edição.
- Registro opcional de contexto, fome, saciedade e mudanças de rotina em texto livre, sem notas, pontuações ou julgamento automático.
- Metas individualizadas e acompanhamentos de hábitos com progresso qualitativo, dificuldades e próximo passo.
- Observações profissionais privadas em tabela própria, nunca compartilhadas automaticamente com o paciente.
- Modo demonstração preservado com dados exclusivamente fictícios e persistência apenas em memória.
- `SupabaseNutritionRepository` preparado para leitura e gravação server-side confirmada por RPC.

## Migration local, ainda não aplicada remotamente

`supabase/migrations/20261108150000_food_diary_and_habits.sql` cria:

- `food_diary_entries`;
- `habit_goals`;
- `habit_check_ins`;
- `clinical_private_notes`;
- enums, índices, chaves compostas, triggers de atualização/auditoria e três RPCs transacionais.

Todas as tabelas têm RLS. `anon` não lê; `authenticated` recebe somente `SELECT` filtrado por política e executa as RPCs autorizadas, sem `INSERT`, `UPDATE` ou `DELETE` direto. As RPCs usam chave de submissão idempotente, conflito otimista e verificações de organização/paciente. Pacientes só podem editar entradas/check-ins criados por eles; recepção não recebe conteúdo clínico; notas privadas são exclusivas de profissionais clínicos atribuídos.

## Evidências locais executadas

- Supabase CLI 3.0.0, imagens slim oficiais e PostgreSQL 17 descartável: migration reaplicada do zero.
- pgTAP: 70 testes aprovados em duas suítes.
- Integração via API local: Auth, recuperação, vínculo profissional, duas organizações, RLS, avaliação, plano, diário, meta, check-in, nota privada e MFA/TOTP aprovados com contas fictícias.
- Vitest: 52 testes aprovados.
- Build TypeScript/Vite: aprovado.
- Playwright/Chromium: 4 cenários aprovados, incluindo prontuário em 1280×900 e 390×844, sem estouro horizontal.
- `npm audit --omit=dev --audit-level=high`: nenhuma vulnerabilidade encontrada.

## Pendências de homologação

- revisar e aprovar a migration para aplicação futura no projeto exclusivo `zwnoxycxhlihqxhutlcy`;
- executar os mesmos cenários RLS/Auth em homologação remota com contas e pacientes fictícios;
- testar backup e restauração, retenção/exclusão e recuperação operacional;
- concluir revisão de acessibilidade e navegador suportado;
- manter `VITE_REAL_DATA_APPROVED=false` até a aprovação formal desses itens.

O projeto antigo `tbbaiowzduqriwdjeacd` não foi acessado nem alterado.
