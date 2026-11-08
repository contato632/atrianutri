# AtriaNutri

Fundação funcional e independente da plataforma de acompanhamento nutricional da AtriaCare.

## Estado desta entrega

Esta branch contém uma demonstração vertical navegável em português brasileiro:

- painel profissional responsivo;
- cadastro, edição, listagem, busca e filtros de pacientes;
- separação de modelos e telas entre dados administrativos e clínicos;
- avaliação antropométrica com validação, IMC, histórico e gráfico de evolução;
- editor manual de planos alimentares, refeições, itens, orientações e versões;
- migration versionada para o projeto Supabase **exclusivo do AtriaNutri**;
- políticas RLS, grants mínimos, vínculo profissional–paciente e auditoria de alterações sensíveis;
- Auth profissional integrado com login, recuperação, troca de senha, sessão em memória e TOTP/MFA;
- `SupabaseNutritionRepository` conectado ao bootstrap da aplicação, atrás de bloqueio de homologação;
- testes unitários, de componentes e contratos de segurança.

Os dados exibidos são fictícios. No modo padrão `demo`, as alterações vivem apenas na memória e desaparecem ao recarregar. O modo Supabase exige configuração explícita, valida o Project Ref e mantém os dados reais bloqueados até a homologação remota de RLS, backup e restauração.

## Executar localmente

Requer Node.js 20 a 24.

```bash
npm install
npm run dev
```

Verificações completas:

```bash
npm run check
npm run test:e2e
```

## Configuração

Copie `.env.example` para `.env` somente quando existir um projeto Supabase próprio e autorizado.

```dotenv
VITE_DATA_MODE=demo
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_REAL_DATA_APPROVED=false
```

O frontend não aceita a referência conhecida do AtriaClinic. Nunca adicione `service_role`, tokens administrativos ou chaves secretas a variáveis `VITE_*`.

`VITE_DATA_MODE=supabase` monta Auth e o adaptador persistente, mas `VITE_REAL_DATA_APPROVED=false` impede o acesso às telas clínicas. O frontend aceita somente o Project Ref `zwnoxycxhlihqxhutlcy` ou localhost em desenvolvimento. A chave pública/publishable pode ser usada no frontend; chaves secretas e `service_role` nunca podem ser incluídas em variáveis `VITE_*`.

## Banco Supabase

A migration `supabase/migrations/20261108122833_atrianutri_foundation.sql` passou em PostgreSQL 17 oficial do Supabase e em 46 testes pgTAP. O schema foi aplicado ao Supabase exclusivo `zwnoxycxhlihqxhutlcy` em 08/11/2026 e registrado na migration remota `20261108122833_atrianutri_foundation`. A interface permanece bloqueada para dados reais até backup/restauração e homologação remota de Auth/RLS.

Testes locais reais com contas fictícias:

```bash
SUPABASE_USE_SLIM_IMAGES=1 supabase start --ignore-health-check
npm run test:db
npm run test:integration:local
```

Não execute esta migration no projeto AtriaClinic `tbbaiowzduqriwdjeacd`.

## Documentação

- [Auditoria do AtriaClinic e decisões de reuso](docs/AUDITORIA_ATRIACLINIC.md)
- [Arquitetura e segurança](docs/ARQUITETURA_E_SEGURANCA.md)
- [Qualidade e escopo de homologação](docs/QUALIDADE.md)
- [Etapa 02 — auditoria RLS e homologação](docs/ETAPA_02_SEGURANCA.md)
- [Etapa 03 — integração Supabase](docs/ETAPA_03_INTEGRACAO_SUPABASE.md)

## Limites de produção

Esta versão não está liberada para pacientes reais. Permanecem pendentes: MFA e fluxos RLS ponta a ponta remotos com contas fictícias, política formal de retenção/exclusão, backup e restauração testados, E2E remoto e revisão jurídica/LGPD.
