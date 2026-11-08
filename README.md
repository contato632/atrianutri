# AtriaNutri

Primeira versão funcional e independente da plataforma de acompanhamento nutricional da AtriaCare.

## Estado desta entrega

Esta branch contém uma demonstração vertical navegável em português brasileiro:

- painel profissional responsivo;
- cadastro, edição, listagem, busca e filtros de pacientes;
- separação de modelos e telas entre dados administrativos e clínicos;
- avaliação antropométrica com validação, IMC, histórico e gráfico de evolução;
- editor manual de planos alimentares, refeições, itens, orientações e versões;
- migrations para um futuro projeto Supabase **exclusivo do AtriaNutri**;
- políticas RLS, grants mínimos, vínculo profissional–paciente e auditoria de alterações sensíveis;
- fundação de Auth profissional com recuperação, sessão em memória e TOTP/MFA;
- `SupabaseNutritionRepository` preparado, mas ainda não ativado;
- testes unitários, de componentes e contratos de segurança.

Os dados exibidos são fictícios. No modo padrão `demo`, as alterações vivem apenas na memória e desaparecem ao recarregar. Não há Supabase conectado e não existe falsa indicação de persistência.

## Executar localmente

Requer Node.js 20 a 24.

```bash
npm install
npm run dev
```

Verificações completas:

```bash
npm run check
```

## Configuração

Copie `.env.example` para `.env` somente quando existir um projeto Supabase próprio e autorizado.

```dotenv
VITE_DATA_MODE=demo
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

O frontend não aceita a referência conhecida do AtriaClinic. Nunca adicione `service_role`, tokens administrativos ou chaves secretas a variáveis `VITE_*`.

`VITE_DATA_MODE=supabase` apenas habilita a criação segura do cliente. Auth e o adaptador persistente estão implementados como fundação, mas permanecem desacoplados da aplicação até a homologação local e a existência de um projeto exclusivo autorizado.

## Banco futuro

A migration `supabase/migrations/202611080001_atrianutri_foundation.sql` foi preparada, mas não aplicada. Ela deve ser testada primeiro com `supabase test db` em um ambiente local descartável e só depois em um novo projeto autorizado.

Não execute esta migration no projeto AtriaClinic `tbbaiowzduqriwdjeacd`.

## Documentação

- [Auditoria do AtriaClinic e decisões de reuso](docs/AUDITORIA_ATRIACLINIC.md)
- [Arquitetura e segurança](docs/ARQUITETURA_E_SEGURANCA.md)
- [Qualidade e escopo de homologação](docs/QUALIDADE.md)
- [Etapa 02 — auditoria RLS e homologação](docs/ETAPA_02_SEGURANCA.md)

## Limites de produção

Esta versão não está liberada para pacientes reais. Permanecem pendentes: projeto Supabase dedicado, execução bem-sucedida da migration/pgTAP local, autenticação e MFA ponta a ponta, ativação controlada do adaptador persistente, política formal de retenção/exclusão, backup e restauração testados, E2E e revisão jurídica/LGPD.
