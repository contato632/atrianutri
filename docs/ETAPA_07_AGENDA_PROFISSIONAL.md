# Etapa 07 — Agenda profissional

## Entrega funcional

A rota `/agenda` oferece visões diária, semanal e mensal, navegação por data, ação Hoje, filtro por profissional e criação direta em um horário livre. O editor abre em painel lateral no desktop e ocupa a largura útil no celular, sem inserir formulários na grade.

Os compromissos possuem categorias e cores próprias para consulta nutricional, retorno, almoço e particular. Consultas e retornos exigem paciente existente; serviço, duração, estado e observação administrativa são independentes do prontuário clínico. Edição, remarcação e cancelamento aceitam uma ocorrência ou a série. Recorrências semanais, quinzenais e mensais têm fim opcional, limite de 104 ocorrências e horizonte máximo de 730 dias; dias inexistentes no mês são ignorados.

A área Gestão agora mantém serviços com nome, duração padrão, valor administrativo opcional e estado ativo/inativo. Não há cobrança ou notificação automática nesta etapa.

## Persistência e segurança

A migration não destrutiva `20261108210000_professional_schedule.sql` cria:

- `professional_services`, `appointment_series`, `appointments`, `appointment_private_details` e `appointment_changes`;
- vínculo composto com organização, profissional, paciente e serviço;
- datas efetivas em `timestamptz` e regra de recorrência com timezone IANA;
- índice temporal e constraint de exclusão GiST contra sobreposição do mesmo profissional;
- RLS por organização e papel, sem escrita direta pelo frontend;
- RPCs transacionais para serviço, criação de série, edição/remarcação e cancelamento lógico;
- detalhe particular separado, legível somente pelo profissional responsável;
- trilha de autoria/alterações e atualização da próxima consulta do paciente.

A recepção pode operar a agenda da própria organização pelas RPCs, mas não lê detalhes privados nem obtém acesso clínico. Nutricionistas não acessam a agenda de colegas; owner/admin/reception têm somente o acesso operacional previsto. O banco rejeita acesso cruzado entre organizações e conflitos de horário, mesmo que o cliente seja contornado.

## Validação executada

- `npm run check`: 75 testes Vitest e build TypeScript/Vite aprovados;
- `npm run test:e2e`: 9 cenários Chromium aprovados em desktop e celular;
- `supabase db reset --no-seed`: quatro migrations reaplicadas em PostgreSQL 17 local descartável;
- `supabase test db`: 103 asserções pgTAP aprovadas;
- `npm run test:integration:local`: Auth, RLS, serviço, agendamento, conflito, cancelamento e MFA validados com duas organizações e contas fictícias.

## Estado de homologação

A migration da agenda foi testada somente na pilha Supabase local e não foi enviada ao projeto remoto. O modo padrão permanece `demo`, em memória. `VITE_REAL_DATA_APPROVED=false` continua obrigatório até aplicação sequencial das migrations 05–07 em homologação, nova rodada remota de RLS/Auth, revisão de backup/restauração, retenção, LGPD e aprovação de segurança.

Não houve deploy, merge, acesso a outros aplicativos nem uso de pacientes reais.
