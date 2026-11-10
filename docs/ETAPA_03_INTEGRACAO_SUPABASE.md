# Etapa 03 — integração com Supabase

Revisão realizada em 8 de novembro de 2026 para o projeto exclusivo informado pelo responsável: `zwnoxycxhlihqxhutlcy`.

## Homologação local executada

- Supabase CLI `3.0.0`, Docker `29.9.2` e PostgreSQL oficial `17.11.0.011-r0`.
- Migration versionada aplicada integralmente em ambiente descartável.
- 46 testes pgTAP executados e aprovados.
- Duas contas profissionais, duas organizações e pacientes exclusivamente fictícios usados no teste HTTP.
- Login real pelo GoTrue, consultas reais pelo PostgREST e escritas por RPC/tabelas autorizadas.
- Recuperação de senha real solicitada sem enumeração do cadastro.
- Enrollment e verificação TOTP reais, com elevação da sessão.
- Leitura e mutação entre organizações negadas por RLS.
- Avaliação persistida com IMC calculado no PostgreSQL.
- Plano e primeira versão confirmados atomicamente pelo servidor.

Inventário pós-migration na pilha oficial local:

- 10 tabelas públicas, todas com RLS habilitado;
- 23 políticas RLS;
- 4 funções públicas e 7 funções privadas;
- 15 triggers de aplicação;
- nenhum grant de tabela para `anon`.

## Integração frontend

- o bootstrap alterna entre `DemoNutritionRepository` e `SupabaseNutritionRepository`;
- o modo Supabase exige URL e chave publishable e aceita somente `zwnoxycxhlihqxhutlcy` ou localhost em desenvolvimento;
- o Project Ref antigo `tbbaiowzduqriwdjeacd` continua explicitamente bloqueado;
- login, recuperação, nova senha, logout e MFA/TOTP estão montados;
- identidade é revalidada por `getUser()` e por vínculo ativo em `organization_members`;
- múltiplas organizações exigem seleção explícita e criam um repositório limitado ao identificador selecionado;
- sessões permanecem somente em memória;
- nenhuma chave administrativa é aceita no frontend.

## Frontend e responsividade executados

- login visual no modo Supabase local com conta fictícia;
- verificação profissional executada pelo serviço real do frontend;
- bloqueio pós-login exibido antes da montagem das telas clínicas;
- Playwright/Chromium aprovado em 1280×800 e 390×844;
- navegação desktop/mobile e ausência de estouro horizontal verificadas.

## Bloqueio de dados reais

`VITE_REAL_DATA_APPROVED` permanece `false`. Mesmo após um login válido, as telas de pacientes, avaliações e planos não são montadas até a homologação remota de RLS, backup e restauração. O modo demonstração permanece o padrão.

## Estado remoto

Nenhuma migration foi aplicada remotamente nesta execução. A auditoria de leitura foi bloqueada antes da conexão porque:

1. o proxy do executor recusou `zwnoxycxhlihqxhutlcy.supabase.co` com HTTP 403;
2. nenhuma credencial Supabase está configurada no ambiente.

Para prosseguir com segurança, o ambiente precisa permitir `api.supabase.com` e `*.supabase.co` e receber `SUPABASE_ACCESS_TOKEN` por cofre/secret binding. A credencial não deve ser enviada no chat nem adicionada ao repositório.

## Atualização pós-execução — migration remota (08/11/2026)

Após a homologação local descrita acima, a migration inicial foi aplicada por conexão Supabase autorizada, exclusivamente ao projeto `zwnoxycxhlihqxhutlcy`.

- Versão registrada pelo Supabase remoto: `20261108122833` (`atrianutri_foundation`).
- O nome do arquivo versionado no repositório foi sincronizado com essa versão, sem modificar o SQL da migration aplicada.
- Inventário remoto verificado: **10 tabelas com RLS**, **23 políticas**, **11 funções**, **15 triggers**.
- Não havia usuários Auth nem pacientes cadastrados; `anon` não possui grants sobre tabelas do aplicativo.
- Advisor de segurança: alerta `authenticated_security_definer_function_executable` relativo a funções `SECURITY DEFINER` executáveis por usuários autenticados. A implementação utiliza RPCs intencionais e valida o ator por `auth.uid()`; mesmo assim, manter a revisão manual e os testes remotos do contrato de acesso como pendência de homologação.
- Advisors de desempenho: informações sobre FKs sem índices de cobertura e índices ainda não utilizados (banco vazio).
- Não foi realizado teste E2E remoto com usuários fictícios, nem backup/restauração do novo banco.
- O modo demonstração e o bloqueio `VITE_REAL_DATA_APPROVED=false` permanecem inalterados.
- PR #1 permanece sem merge, e nenhum deploy de aplicativo foi solicitado.
