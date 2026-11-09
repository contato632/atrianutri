# Etapa 11 — preparação da homologação remota

Preparação realizada em 9 de novembro de 2026 a partir do commit `00ab951705fe8608244343ac0e53a6fc91d39807`. Este documento separa evidências executadas de atividades que continuam planejadas.

## Estado da inspeção remota

### Executado

- Confirmado checkout limpo na branch `codex/atrianutri-foundation-v1` e no commit inicial informado.
- Revisado o checklist da Etapa 10.
- Tentado acesso somente de leitura ao dashboard do projeto `zwnoxycxhlihqxhutlcy` e ao endpoint público `/auth/v1/health`.
- O proxy do executor recusou o túnel ao domínio do projeto com HTTP 403 antes de alcançar o Supabase.
- O navegador compartilhado não carregou Supabase nem hPanel e não possuía sessão autenticada existente.
- O executor não possui token Supabase, URL de banco, senha de banco ou identidade externa configurada.
- Os dois SQLs de auditoria foram executados com sucesso na pilha Supabase local PostgreSQL 17.11.
- Um primeiro ensaio com `--no-acl` demonstrou que excluir ACLs perde `REVOKE/GRANT` de funções e pode devolver execução a `anon`; esse formato foi rejeitado.
- Foi gerado um segundo dump local fictício em formato custom **incluindo ACLs**, validado por `pg_restore --list`, com 438.403 bytes e SHA-256 `64d3743554cde8145e354260a2b1fa517b45ccc0ba214acc062539308057882f`.
- O segundo dump foi restaurado sem erro, por uma role local compatível, em `atrianutri_restore_verify_acl`; o verificador reforçado confirmou histórico, RLS, políticas, ACLs, RPCs privadas e as correções de agenda/financeiro.

### Não executado — não homologado

- Inventário autenticado do banco remoto.
- Confirmação independente do histórico remoto de migrations.
- Exportação de backup remoto.
- Restauração do backup em ambiente isolado.
- Testes remotos com dados fictícios.
- Verificação do auto-deploy no hPanel.

A afirmação anterior de que somente a migration de fundação está aplicada permanece uma informação histórica do repositório, não uma constatação remota reproduzida nesta etapa. Antes de qualquer aplicação, executar `supabase/audit/remote_readonly_inventory.sql` com credencial somente de leitura e anexar a saída sanitizada à homologação.

## Inventário remoto a coletar

O arquivo `supabase/audit/remote_readonly_inventory.sql` abre uma transação explicitamente `READ ONLY`, limita tempo de consulta e coleta somente metadados:

- banco, papel de conexão e PostgreSQL;
- `supabase_migrations.schema_migrations`;
- schemas e extensões;
- tabelas, RLS e número de políticas;
- políticas públicas sem retornar conteúdo de linhas;
- funções, argumentos, `SECURITY DEFINER`, `search_path` e permissões de execução;
- grants de `anon` e `authenticated`;
- triggers;
- nomes das tabelas de Auth, sem usuários, e-mails ou identidades.

Auth também precisa ser conferido no dashboard/Management API: site URL, redirects autorizados, confirmação de e-mail, comprimento e requisitos de senha, rotação de refresh token, sign-up, MFA/TOTP e provedores ativos. Esses valores não são integralmente observáveis pelo PostgreSQL.

## Checksums e sequência definitiva

| Ordem | Migration | SHA-256 | Dependência principal |
|---:|---|---|---|
| 1 | `20261108122833_atrianutri_foundation.sql` | `8054fc8eae97bde61fad09951f32ed8b69dd93df30e31201ffb57aaa6887352d` | `auth.users`, `pgcrypto`; já reportada como aplicada |
| 2 | `20261108150000_food_diary_and_habits.sql` | `2d95147e6f44779b8f6c293ef0d25c9a400e8b405803534b0c0ba141e665c763` | fundação, pacientes, helpers e auditoria |
| 3 | `20261108180000_complete_nutrition_evaluation.sql` | `683fb88b223dedca5d2902547b8efcf387b1ac535ead3ea7b78edaf310390a88` | fundação, pacientes e auditoria |
| 4 | `20261108210000_professional_schedule.sql` | `5f13d48a94316e54595fa18f757e8e34f30d697ab2f68abdd18325346ebb2770` | fundação, pacientes, membros e helpers |
| 5 | `20261108213000_professional_schedule_hardening.sql` | `81f59fde23c253b6f8c7d39c817924aab462540bafc8118bdff8c309240d377b` | agenda completa |
| 6 | `20261108230000_office_finance.sql` | `b3859165ef23f4c688e3f9689d600861d5572da114cfc5e63d32d0619ebc5ffe` | fundação, agenda e serviços |
| 7 | `20261109090000_private_appointment_operational_fix.sql` | `189641f64632fc28281104c1189fbb56a468ba0f7dc8fbe8eca6b7522f3ce787` | hardening da agenda |
| 8 | `20261109180000_finance_reversal_ambiguity_fix.sql` | `851749db40bdb8e64f0ace09e2df47c0353d211ce2b7b9ae4cfc08304927b034` | financeiro |

As migrations 2–8 são as sete pendentes. Elas foram aplicadas em sequência e testadas na pilha local na Etapa 10, mas ainda precisam ser comparadas com o inventário remoto real. Interromper se a versão 1 estiver ausente, se existir qualquer versão inesperada, se houver objeto homônimo divergente ou se o checksum local não corresponder ao artefato aprovado.

## Revisão de segurança das RPCs

- Todas as RPCs sensíveis usam `SECURITY DEFINER` com `search_path` vazio na estrutura local validada.
- Criação/alteração clínica depende de organização, paciente, vínculo profissional e `auth.uid()`.
- Notas clínicas privadas não têm escrita direta pelo papel `authenticated`; são vinculadas ao registro pai por RPC.
- Agenda valida organização, profissional, paciente, serviço, concorrência otimista e conflito de horário.
- O hardening impede recepção de sobrescrever o título privado de compromisso pessoal.
- Financeiro separa `view`, `operational` e `manage`; tabelas financeiras não aceitam escrita direta do cliente.
- Pagamentos possuem chave de idempotência e limite pelo saldo; estornos são movimentos compensatórios; cobrança só pode ser cancelada após saldo líquido zero.
- A correção da migration 8 qualifica `payment.amount_cents` no estorno e deve ser confirmada após aplicação pelo script `post_migration_verification.sql`.

Riscos que exigem validação remota: drift de grants/policies, configuração Auth diferente do `config.toml`, funções manuais fora do histórico, extensões/versão incompatíveis, dados preexistentes que violem novas FKs/checks e permissões concedidas diretamente a usuários ou roles não inventariadas.

## Backup e restauração verificável

Status remoto: **planejado, não executado e não homologado**. O ensaio local descrito acima valida o formato custom, a restauração limpa e os verificadores, mas não comprova que um backup do projeto remoto possa ser restaurado.

1. Criar diretório criptografado e restrito para os artefatos; nunca versioná-los.
2. Usar PostgreSQL 17 e um `PGPASSFILE` temporário com modo `0600`; não colocar senha na linha de comando ou histórico.
3. Registrar `pg_dump --version`, Project Ref, horário UTC, tamanho e SHA-256 dos arquivos.
4. Exportar globals/roles permitidos, schema, dados **e ACLs** em formato custom, incluindo `public`, `auth`, `storage` e `supabase_migrations`. Não usar `--no-acl`: o ensaio local provou que isso remove revogações essenciais. Preservar também a configuração Auth obtida pelo dashboard/Management API em registro separado sem segredos.
5. Validar o arquivo com `pg_restore --list` e armazenar cópia criptografada segundo a política de retenção.
6. Provisionar um Supabase/PostgreSQL 17 isolado, sem rotas de produção e sem integrações externas.
7. Restaurar roles compatíveis, schema e dados. Tratar ownerships gerenciados pelo Supabase conforme documentação oficial; nunca restaurar por cima do projeto original.
8. Executar `ANALYZE`, inventário, `post_migration_verification.sql`, contagens agregadas e testes de Auth/RLS com contas fictícias.
9. Medir duração, registrar RPO/RTO, comparar checksums/contagens e destruir o ambiente isolado somente após aceite da evidência.

Critérios de sucesso: restauração sem erro, histórico idêntico, objetos esperados, zero tabela pública sem RLS/política, zero `SECURITY DEFINER` inseguro, zero função da aplicação executável por `anon`, Auth utilizável e isolamento organizacional aprovado. Qualquer falha mantém `VITE_REAL_DATA_APPROVED=false`.

## Plano de aplicação com interrupções

1. **Pré-janela:** confirmar Project Ref em duas fontes, inventário remoto, histórico exato contendo somente `20261108122833`, checksums, backup íntegro e restauração aprovada.
2. **Migration 2:** aplicar diário/hábitos; verificar objetos, RLS, grants, RPCs e pgTAP correspondente.
3. **Migration 3:** aplicar avaliação completa; verificar FKs, autoria, auditoria sem conteúdo clínico e pgTAP correspondente.
4. **Migration 4:** aplicar agenda; verificar serviços, séries, conflitos e atualização de próxima consulta.
5. **Migration 5:** aplicar hardening; verificar exceções, FKs de serviço e proteção de detalhes privados.
6. **Migration 6:** aplicar financeiro; verificar roles, grants, idempotência, estorno e trilha financeira.
7. **Migration 7:** aplicar proteção operacional; confirmar que recepção não altera título privado.
8. **Migration 8:** aplicar correção do estorno; confirmar a função pelo verificador somente de leitura.
9. **Pós-aplicação:** executar o verificador completo, pgTAP remoto e testes fictícios. Não habilitar dados reais.

Interromper imediatamente em: Project Ref divergente; histórico/checksum inesperado; erro SQL; lock prolongado; objeto homônimo divergente; perda de RLS/grant; `SECURITY DEFINER` sem `search_path`; teste de isolamento, agenda, privacidade, financeiro ou Auth falhando; backup/restauração sem evidência; ou alteração inesperada da demonstração.

## Matriz de testes remotos preparada

Criar exclusivamente contas e pacientes marcados como fictícios e descartáveis:

- Organização A: owner, nutricionista A, recepção A, financeiro `view`, `operational` e `manage`, paciente A.
- Organização B: owner/nutricionista B e paciente B.
- Conta inativa e sessão anônima.

Executar: login, recuperação sem enumeração, troca de senha, logout, enrollment/challenge/verify TOTP, revogação; isolamento A/B para SELECT e mutação; administrativo versus clínico; nota privada; compromisso particular; conflito e recorrência; diário/meta/check-in; avaliação/recordatório; plano/versionamento; cobrança, pagamento parcial/integral, repetição idempotente, estorno e cancelamento; auditoria sem conteúdo clínico; quatro PDFs locais. Remover os registros fictícios somente por procedimento aprovado e auditável após a homologação.

## Hostinger e GitHub

Status: **não verificado no hPanel**. O repositório não contém workflow GitHub Actions nem status de deployment no commit inicial, e o navegador desta sessão não alcançou o hPanel. Como um push pode acionar integração externa invisível ao GitHub, esta preparação deve permanecer local até confirmar no hPanel: repositório, branch monitorada, auto-deploy, comando de build, diretório de saída e último deployment associado ao SHA.

Nenhum push, deploy manual, merge, migration remota ou variável de produção foi alterado nesta etapa até esta revisão.
