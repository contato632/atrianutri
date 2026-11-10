# Etapa 10 — consolidação e checklist de homologação

Revisão local realizada em 9 de novembro de 2026 a partir do commit `58707933966f78708757661106dc4e706c10c8bb`. Nenhuma migration foi aplicada ao Supabase remoto, nenhum dado real foi habilitado e nenhum deploy manual foi executado.

## Resultado da auditoria

- Datas de cabeçalho, indicadores relativos e valores padrão de formulários agora são calculados uma vez por renderização em `America/Bahia`.
- O atalho **Ver agenda** navega corretamente; controles laterais sem ação foram removidos.
- A agenda do painel usa a categoria e a duração do agendamento persistido, sem depender da posição visual.
- Os filtros financeiros abrem no mês corrente e os estados de vencimento usam a data corrente da Bahia.
- Referências visuais a outros produtos foram removidas da Gestão. O bloqueio técnico explícito ao Project Ref proibido foi preservado.
- A execução funcional revelou uma ambiguidade no RPC de estorno. A correção está isolada na migration complementar `20261109180000_finance_reversal_ambiguity_fix.sql`, sem reescrever o histórico anterior.

## Sequência candidata de migrations remotas

Aplicar somente após autorização formal e confirmação inequívoca do Project Ref `zwnoxycxhlihqxhutlcy`:

1. `20261108122833_atrianutri_foundation.sql` — já consta no histórico remoto; verificar checksum e não reaplicar.
2. `20261108150000_food_diary_and_habits.sql`.
3. `20261108180000_complete_nutrition_evaluation.sql`.
4. `20261108210000_professional_schedule.sql`.
5. `20261108213000_professional_schedule_hardening.sql`.
6. `20261108230000_office_finance.sql`.
7. `20261109090000_private_appointment_operational_fix.sql`.
8. `20261109180000_finance_reversal_ambiguity_fix.sql`.

Antes da aplicação, comparar `supabase_migrations.schema_migrations` e checksums locais com o histórico remoto. Não usar `db reset`, não editar uma migration já aplicada e interromper diante de divergência.

## Checklist obrigatório antes de dados reais

- [ ] Exportar e validar backup lógico completo, incluindo schemas `auth`, `public` e histórico de migrations.
- [ ] Registrar versão do PostgreSQL, extensões, tamanho, integridade do arquivo e retenção criptografada do backup.
- [ ] Restaurar o backup em projeto descartável isolado e medir RPO/RTO; confirmar contagens, vínculos, funções, triggers, RLS e Auth.
- [ ] Conferir dependências e ordem das oito migrations em clone descartável da produção.
- [ ] Aplicar com uma conta operacional dedicada, janela aprovada e log de cada versão; nunca usar o projeto proibido.
- [ ] Reexecutar pgTAP e os fluxos REST/Auth/MFA com duas organizações, profissionais e pacientes exclusivamente fictícios.
- [ ] Validar owner/admin, nutrição, recepção, paciente, financeiro `view`/`operational`/`manage`, usuário inativo e acesso anônimo.
- [ ] Revalidar compromissos particulares: recepção vê apenas campos operacionais e nunca o título privado.
- [ ] Revalidar cobrança, idempotência, pagamento parcial/integral, estorno compensatório, cancelamento e trilha financeira.
- [ ] Conferir todos os `SECURITY DEFINER` com `search_path` vazio, grants mínimos e ausência de escrita direta em tabelas sensíveis.
- [ ] Executar Auth real: login, recuperação, troca de senha, logout, vínculo profissional, MFA/TOTP e revogação de sessão.
- [ ] Gerar os quatro PDFs com registros fictícios e verificar exclusão de notas privadas, paginação, versão do plano e processamento local.
- [ ] Configurar somente `VITE_SUPABASE_URL` e chave publishable no frontend. Nunca expor `service_role`, secret key, senha de banco ou token administrativo.
- [ ] Manter `VITE_REAL_DATA_APPROVED=false` até aprovação conjunta de segurança, restauração, LGPD e aceite funcional.
- [ ] Definir controlador/operador, bases legais, finalidade, minimização, retenção, descarte, direitos do titular, resposta a incidente e registro de acessos conforme LGPD.
- [ ] Obter aceite formal antes de alternar a persistência real e monitorar erros/RLS sem registrar conteúdo clínico em logs.

## Estratégia de rollback

Não reverter migrations destrutivamente. Se a aplicação falhar, interromper a sequência, preservar logs e manter `VITE_REAL_DATA_APPROVED=false`. Para alterações aditivas, produzir migration compensatória revisada. Para corrupção ou incompatibilidade não compensável, restaurar o backup testado em um novo projeto, validar a restauração e só então trocar a configuração mediante autorização. O projeto atual não deve receber `db reset` remoto.

## Publicação demonstrativa

O repositório não contém workflow GitHub Actions, configuração Hostinger ou status de deployment associado ao commit auditado. A tentativa de inspeção somente de leitura do painel Hostinger não ficou disponível no executor. Portanto, a integração externa deve ser tratada como potencialmente automática: qualquer push nesta branch pode atualizar a demonstração. Nenhum deploy manual foi realizado nesta etapa; confirmar no hPanel o repositório, a branch e a opção de auto-deploy antes de uma liberação de produção.

## Critério de saída

A versão só deixa de ser demonstração quando todos os itens acima estiverem evidenciados, as pendências jurídicas e operacionais estiverem aprovadas, os testes remotos fictícios passarem e houver autorização separada para definir `VITE_REAL_DATA_APPROVED=true`. Esta etapa, isoladamente, não concede essa autorização.
