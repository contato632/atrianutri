# Arquitetura e segurança

## Frontend

React + TypeScript + Vite, organizado por responsabilidade:

- `domain/`: modelos, cálculos e validações sem dependência de UI;
- `data/`: contrato de repositório, implementação demonstrativa e dados fictícios;
- `state/`: coordenação das operações da sessão;
- `components/`: componentes reutilizáveis e acessíveis;
- `pages/`: fluxos verticais de pacientes, avaliações, planos e gestão;
- `lib/supabase.ts`: criação opcional do cliente, sem URL ou chave fixa.

A interface padrão usa `DemoNutritionRepository`. Ela clona os dados iniciais e os mantém apenas em memória. Não usa `localStorage`, `sessionStorage`, cookies de aplicação ou chamadas a bancos.

## Modelo futuro do banco

A migration versionada separa:

- `patients_administrative`: identificação, contato e estado administrativo;
- `patient_clinical_profiles`: objetivo, história, hábitos e notas profissionais;
- `nutrition_assessments`: medidas, IMC calculado no banco e observações;
- `meal_plans`: cabeçalho e estado do plano;
- `meal_plan_versions`: snapshots imutáveis das refeições em JSON;
- `audit_events`: metadados mínimos de alterações.

Toda entidade sensível possui `organization_id` direto ou por chave composta. A chave composta entre paciente e organização impede vínculos acidentais com registros de outra clínica.

## Autorização proposta

- `owner` e `admin`: gestão administrativa da organização;
- `reception`: cadastro e contato, sem acesso clínico;
- `nutritionist`: acesso clínico somente quando `clinical_access=true` e houver atribuição ativa ao paciente;
- paciente autenticado: leitura do próprio cadastro e, futuramente, somente avaliações compartilhadas e versão ativa do plano;
- `anon`: nenhum acesso às tabelas.

As políticas são separadas por operação. O frontend melhora a experiência, mas a fronteira de autorização está no PostgreSQL/RLS.

## Auditoria

Triggers registram organização, ator, entidade, identificador, operação, horário e campos alterados. A lista remove nomes de campos que revelariam identificação, contato, medidas, notas e conteúdo alimentar. Clientes autenticados não podem inserir, editar ou apagar eventos.

Limites: a trilha não é criptograficamente inviolável, ainda não cobre leitura, login ou ações do painel Supabase e precisa de retenção definida.

## LGPD e ciclo de vida

Princípios já refletidos no desenho:

- minimização e separação entre cadastro e informação clínica;
- acesso mínimo por papel, organização e vínculo profissional;
- ausência de dados reais em demonstração/testes;
- histórico imutável de versões e auditoria sem duplicar conteúdo sensível;
- nenhuma chave administrativa no cliente.

Antes da produção, definir e implementar:

- base legal, avisos de privacidade e registro do consentimento quando aplicável;
- prazos por categoria de dado e suspensão de exclusão por obrigação legal;
- fluxo verificado de acesso, portabilidade, correção, anonimização e exclusão;
- exclusão coordenada entre Auth, tabelas, Storage, logs e backups;
- criptografia operacional, resposta a incidentes e revisão de fornecedores;
- política e teste de backup/restauração, RPO/RTO e controle de acesso a cópias.

## Referências Supabase verificadas

Em 8 de novembro de 2026 foram consultadas as fontes oficiais atuais no repositório `supabase/supabase`:

- Row Level Security: habilitar RLS em toda tabela exposta, revogar grants padrão e criar/testar políticas por operação;
- User Management: referenciar somente a chave primária de `auth.users`, usar RLS em tabelas públicas e testar triggers de cadastro.

Links públicos: <https://supabase.com/docs/guides/database/postgres/row-level-security> e <https://supabase.com/docs/guides/auth/managing-user-data>.

## Implantação segura da migration

1. Criar um projeto Supabase dedicado somente após autorização expressa.
2. Confirmar que a referência não é `tbbaiowzduqriwdjeacd`.
3. Executar `supabase start` e `supabase test db` localmente.
4. Adicionar cenários multiusuário com JWTs distintos e negar acesso cruzado.
5. Revisar migration e plano de rollback.
6. Aplicar primeiro em homologação vazia.
7. Homologar Auth/MFA, convites, recuperação e auditoria.
8. Somente então avaliar produção; nunca habilitar dados clínicos incompletos.
