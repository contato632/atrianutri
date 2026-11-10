# AtriaNutri — Etapa 16: Vínculo Profissional–Paciente

## Resultado

A demonstração agora permite criar e administrar convites, identificar vínculos ativos, publicar uma versão específica do plano, suspender o compartilhamento e encerrar o vínculo. O portal continua funcional para diário e metas, mas passa a depender de vínculo ativo e publicação explícita.

A migration complementar e o pgTAP foram preparados localmente. Eles **não foram aplicados nem executados com sucesso**, porque a imagem PostgreSQL 17 não coube no armazenamento disponível do daemon Docker. Nenhuma alteração remota foi realizada.

## Fluxo demonstrativo

### Convites

No prontuário do paciente, o painel **Vínculo e compartilhamento** oferece:

- criação individual de convite;
- estado pendente, cancelado ou expirado;
- cópia de mensagem sem conteúdo clínico;
- preparação de links para WhatsApp e e-mail, sem envio automático;
- cancelamento de convite pendente;
- criação de novo convite após cancelamento ou expiração.

O parâmetro `convite-demonstrativo` usa apenas o identificador fictício e não autentica, vincula ou libera dados. Ele não é tratado como token de produção.

### Vínculo

O modelo `PatientProfessionalLink` registra organização, paciente, profissional responsável, usuário do paciente, estado, ativação e encerramento. A demonstração contém um vínculo ativo fictício para Ana Beatriz Lima.

Encerrar o vínculo:

1. altera o estado para `ended`;
2. registra a data de encerramento;
3. revoga todas as publicações ativas daquele paciente;
4. faz o portal negar acesso imediatamente.

O frontend não possui operação para associar arbitrariamente `patientId` a um usuário. Na integração real, somente a RPC de aceite poderá criar o vínculo.

### Publicação do plano

O editor profissional possui o controle **Disponibilizar ao paciente**:

- seleção de uma revisão já salva;
- publicação explícita;
- substituição da publicação atual;
- suspensão;
- histórico das versões publicadas e revogadas.

`publishedPlanVersion` reconstrói o plano a partir do snapshot imutável da revisão selecionada. O rascunho atual pode continuar sendo editado sem modificar o conteúdo disponível no portal.

## Indicadores profissionais

O prontuário apresenta indicadores discretos para:

- paciente vinculado ou sem vínculo;
- convite pendente;
- plano disponibilizado;
- registros alimentares criados pelo paciente após a carga inicial fictícia;
- acompanhamentos de metas criados pelo paciente após a carga inicial fictícia.

Os indicadores de novos registros são derivados de gravações efetivas na sessão. Não há contadores aleatórios ou notificações simuladas.

## Sincronização de diário e metas

As operações específicas do portal preservam:

- paciente;
- data e horário;
- conteúdo relatado;
- `source = patient`;
- chave de submissão;
- criação e atualização;
- ausência de nota profissional privada.

O prontuário profissional já distingue registros de origem `patient` e `professional`. O paciente só acompanha metas compartilhadas e não pode alterar título, descrição ou estado definidos pelo profissional.

## Migration local

Arquivo: `supabase/migrations/20261110120000_patient_portal_links.sql`.

Ela adiciona:

- `patient_portal_invitations`;
- `patient_portal_links`;
- `meal_plan_publications`;
- enums de estado;
- índices únicos para vínculo e publicação ativos;
- auditoria sem conteúdo clínico;
- RLS negando por padrão;
- substituição de `is_patient_self` para exigir vínculo ativo;
- políticas de plano baseadas na publicação escolhida;
- RPCs auditáveis para convite, aceite, cancelamento, publicação e encerramento.

### Convite de produção

`create_patient_portal_invitation`:

- exige profissional com acesso clínico ao paciente;
- busca e-mail e profissional no banco;
- gera 32 bytes aleatórios com `gen_random_bytes`;
- retorna o segredo somente na criação;
- armazena apenas `digest(token, 'sha256')`;
- expira em 72 horas;
- rejeita outro convite pendente.

`accept_patient_portal_invitation`:

- exige `auth.uid()`;
- consulta o e-mail confirmado em `auth.users`, não em `user_metadata`;
- bloqueia a linha do convite;
- valida hash, estado, expiração e e-mail;
- impede vincular um cadastro já associado a outro usuário;
- cria o vínculo no servidor;
- marca o convite como utilizado uma única vez.

O fluxo atende tanto conta existente quanto novo paciente: novos pacientes criam e confirmam a conta Auth antes de consumir o convite. O cadastro Auth em si não concede acesso clínico.

### Publicação e revogação

`publish_meal_plan_version` valida profissional, paciente, vínculo ativo e revisão existente. Uma nova publicação revoga a anterior, preservando o histórico. `revoke_meal_plan_publication` suspende explicitamente a publicação atual.

`end_patient_portal_link` encerra o vínculo e revoga publicações na mesma transação. Como `is_patient_self` exige vínculo ativo, diário, metas, avaliações compartilhadas e planos deixam de ser legíveis imediatamente.

### Funções privilegiadas

As funções usam `SECURITY DEFINER` somente onde a operação precisa validar e alterar múltiplas tabelas em uma transação confiável. Todas possuem `search_path = ''`, revogação de `PUBLIC`/`anon`/`service_role` e concessão apenas a `authenticated`. As decisões continuam baseadas em `auth.uid()` e consultas ao banco.

## Modelo de permissões

| Recurso | Profissional autorizado | Paciente com vínculo ativo | Sem vínculo / outra organização |
|---|---|---|---|
| Convite | Cria, consulta e cancela por RPC | Consome por token após Auth | Negado |
| Vínculo | Consulta e encerra por RPC | Consulta o próprio ativo | Negado |
| Plano/revisão | Edita e publica | Lê somente versão publicada | Negado |
| Diário | Lê o paciente atribuído | Cria e lê próprios/compartilhados | Negado |
| Meta | Define e compartilha | Lê e acompanha; não edita definição | Negado |
| Nota privada | Lê conforme acesso clínico | Nunca | Negado |
| Financeiro | Conforme permissão financeira | Nunca | Negado |

## Autenticação planejada

1. Profissional cria convite no servidor.
2. Paciente novo cria e confirma uma conta Supabase Auth; paciente existente entra normalmente.
3. Usuário autenticado envia o token à RPC de aceite.
4. O servidor compara o hash e a identidade confiável.
5. Um vínculo ativo passa a autorizar o portal.
6. Recuperação, logout e sessão expirada são tratados pelo Supabase Auth.
7. Encerramento do vínculo revoga o acesso clínico sem apagar a conta Auth.

O modo demonstração permanece separado. `SupabaseNutritionRepository` bloqueia convites e publicações reais até a homologação da migration.

## Testes

### Executados

- Vitest completo: **131 testes aprovados em 20 arquivos**.
- Playwright completo: **27 fluxos aprovados**, incluindo quatro de vínculo/publicação e cinco do portal.
- Build TypeScript/Vite: aprovado.
- `git diff --check`: aprovado.

### Preparados, mas não executados

`supabase/tests/patient_portal_links_rls_test.sql` cobre:

- ausência de privilégios diretos;
- token opaco e armazenamento somente do hash;
- convite pendente único;
- bloqueio entre organizações;
- bloqueio de paciente incorreto;
- utilização única;
- vínculo correto;
- plano invisível antes da publicação;
- substituição com histórico;
- leitura somente da versão publicada;
- proteção clínica e financeira;
- revogação após encerramento.

A tentativa de iniciar `supabase start` em 10 de novembro de 2026 falhou durante o download da imagem `supabase/postgres:17.11.0.011`: `no space left on device`. Portanto, a nova migration e o pgTAP **não estão homologados**. Os testes PostgreSQL existentes também não foram repetidos nesta etapa.

## Pendências para ativação remota

1. Liberar espaço no daemon Docker e executar toda a sequência de migrations em banco descartável.
2. Executar todos os testes pgTAP, incluindo regressão das políticas anteriores.
3. Corrigir qualquer incompatibilidade encontrada; não alterar migrations já aplicadas remotamente.
4. Integrar as RPCs ao repositório Supabase somente após os testes locais.
5. Homologar cadastro, confirmação de e-mail, recuperação, sessão expirada e logout com contas fictícias.
6. Testar duas organizações, reutilização, expiração e revogação em Auth real local.
7. Revisar logs, auditoria, backup e restauração.
8. Solicitar autorização específica antes de qualquer migration remota.

Até essas etapas, dados reais, convites reais e persistência clínica remota permanecem bloqueados.
