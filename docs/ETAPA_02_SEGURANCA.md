# Etapa 02 — auditoria de segurança e homologação

Revisão realizada em 8 de novembro de 2026 sobre a migration inicial, ainda não aplicada a nenhum projeto remoto.

## Correções de segurança

1. `meal_plan_versions` agora referencia `(meal_plan_id, organization_id, patient_id)` em `meal_plans`. Uma versão não pode usar outro paciente da mesma organização nem atravessar organizações.
2. `patient_professional_assignments` exige que o profissional seja membro da mesma organização.
3. A gestão de membros ficou conservadora: somente o proprietário pode criar ou alterar outro membro não proprietário. Autoalteração e criação/promoção para `owner` estão bloqueadas.
4. Pacientes são criados pela RPC `create_patient_administrative`, que fixa autoria no servidor e autoatribui somente o profissional clínico criador.
5. Planos e versões são criados pelas RPCs `create_meal_plan_draft` e `save_meal_plan_version`.
6. O salvamento de versão usa `FOR UPDATE`, versão esperada e erro `40001` para impedir perda silenciosa por concorrência.
7. Clientes não recebem `INSERT`, `UPDATE` ou `DELETE` em `meal_plan_versions`; snapshots permanecem imutáveis.
8. `organization_id`, `patient_id`, autoria e `current_version` não possuem grants de atualização para clientes.

## Matriz RLS e grants

| Tabela | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | Próprio usuário | Próprio usuário | Nome/registro do próprio usuário | Negado |
| `organizations` | Membro ativo | RPC `create_organization` | Proprietário/admin; somente nome e fuso | Negado |
| `organization_members` | Membros da própria organização, se ator ativo | Somente proprietário; nunca novo `owner` | Somente proprietário, outro membro não proprietário | Negado |
| `patients_administrative` | Próprio paciente; administração da organização; profissional atribuído | RPC auditada | Campos administrativos; paciente não edita a própria linha | Negado |
| `patient_professional_assignments` | Usuário com acesso administrativo ao paciente | Proprietário/admin; profissional deve pertencer à organização | Somente campo `active`, por proprietário/admin | Negado |
| `patient_clinical_profiles` | Profissional clínico ativo e atribuído | Mesmo profissional, autoria própria | Campos clínicos, mantendo vínculo e autoria | Negado |
| `nutrition_assessments` | Profissional atribuído; paciente somente se compartilhada | Profissional atribuído, autoria própria | Medidas/notas; vínculo e autoria imutáveis | Negado |
| `meal_plans` | Profissional atribuído; paciente somente plano ativo próprio | RPC transacional | Título/estado/ativação por profissional atribuído | Negado |
| `meal_plan_versions` | Profissional atribuído; paciente somente versão atual do plano ativo | RPC transacional | Negado | Negado |
| `audit_events` | Proprietário/admin da organização | Somente triggers `SECURITY DEFINER` | Negado | Negado |

## Funções `SECURITY DEFINER`

- todas usam `set search_path = ''` e nomes totalmente qualificados;
- funções internas ficam em schema não exposto;
- execução pública/anônima é revogada;
- RPCs derivam autoria de `auth.uid()`, não de argumentos do cliente;
- operações de plano validam vínculo clínico antes da escrita;
- o trigger de auditoria registra apenas metadados e remove nomes de campos sensíveis.

## Testes PostgreSQL preparados

`supabase/tests/rls_isolation_test.sql` usa transação com `ROLLBACK` e identidades fictícias para duas organizações. A suíte cobre:

- isolamento A/B para pacientes, avaliações e planos;
- paciente sem atribuição profissional;
- recepção administrativa sem acesso clínico;
- perda imediata de acesso para profissional desativado;
- isolamento entre pacientes;
- auditoria não gravável por clientes;
- snapshots de plano imutáveis;
- bloqueio de autoelevação de cargo/acesso clínico;
- chave composta plano–organização–paciente;
- profissional pertencente à mesma organização;
- concorrência otimista e confirmação da versão no servidor.

## Resultado final da validação local

- Supabase CLI verificada: `3.0.0`.
- Docker local verificado: `29.9.2`.
- `supabase start` foi executado sem vínculo remoto.
- A imagem completa falhou no driver VFS por falta de espaço, mas a variante slim oficial da CLI foi iniciada com PostgreSQL `17.11.0.011-r0`, GoTrue e PostgREST.
- A migration foi aplicada do início ao fim na pilha oficial.
- `supabase test db` executou os 46 testes pgTAP: 46 aprovados, 0 falhas.
- Um teste HTTP adicional usou duas contas e organizações fictícias para confirmar Auth, PostgREST, RPCs, persistência e bloqueio de leitura/mutação cruzada por RLS.
- O healthcheck interno do GoTrue recebeu 403 do proxy do executor; o endpoint real `/auth/v1/health` respondeu 200 e os logins fictícios funcionaram. A pilha foi usada com `--ignore-health-check` somente no ambiente local descartável.

## Estado de Auth e persistência

Os componentes de login profissional, recuperação, sessão, logout e TOTP estão preparados, mas não são montados no modo demonstração. A verificação exige `getUser()`, vínculo profissional ativo e AAL2 quando configurado. Sessões estão configuradas como somente em memória (`persistSession: false`).

`SupabaseNutritionRepository` implementa o contrato de leitura/escrita, traduz conflitos e só retorna sucesso quando a resposta do servidor contém identificador, versão e horário confirmados. O adaptador ainda não substitui `DemoNutritionRepository`.
