# Auditoria do AtriaClinic e decisões de reuso

Auditoria realizada em 8 de novembro de 2026 sobre o commit `e75a617` da branch `main` de `contato632/atriaclinic`. A análise foi feita em uma cópia local de referência; nenhum arquivo, banco ou deploy do AtriaClinic foi modificado.

## Estrutura observada

O AtriaClinic é uma aplicação Node.js com frontend JavaScript/CSS estático e acesso direto às APIs Supabase. As áreas relevantes são:

- `server.mjs`: servidor HTTP, rotas estáticas, CSP e cabeçalhos de segurança;
- `public/app.*`: autenticação, recuperação de senha, MFA e seleção de clínica;
- `public/operacao.*`: pacientes administrativos, agenda e serviços;
- `public/financeiro.js`, `equipe.js`, `auditoria.js`: módulos administrativos separados;
- `frontend/atria-clinic-api.mjs`: camada de integração;
- `backend/*.sql`: endurecimento de RLS por clínica/profissional, MFA e auditoria;
- `supabase/functions`: operações administrativas privilegiadas;
- `tests`: contratos estáticos, segurança, backup e roteiros manuais.

O repositório referencia o Supabase `tbbaiowzduqriwdjeacd`, possui deploy automático da `main` e avisa que suas rotas autenticadas ainda são de homologação.

## Matriz de decisão

| Área | Decisão no AtriaNutri | Justificativa |
| --- | --- | --- |
| Navegação lateral e responsiva | Adaptada | Mantida a linguagem administrativa, redesenhada para as cinco áreas do produto nutricional. |
| Tokens visuais, cards e hierarquia | Adaptados | Paleta azul AtriaCare preservada com componentes novos em React/CSS. Nenhum arquivo visual foi copiado integralmente. |
| Sessão e autenticação Supabase | Substituídas | O AtriaClinic contém URL/chave pública próprias. O AtriaNutri recebeu somente um cliente configurável e bloqueio explícito da referência antiga. |
| Pacientes administrativos | Conceito adaptado | CRUD e busca foram reimplementados; o modelo clínico agora está em tabela e domínio separados. |
| Agenda e recorrências | Planejadas para adaptação | O padrão funcional é útil, mas não foi copiado nesta entrega para evitar escopo incompleto. |
| Serviços, financeiro e equipe | Planejados para adaptação | A organização modular e os papéis são reaproveitáveis; schema e dados serão exclusivos do AtriaNutri. |
| RLS por clínica/profissional | Adaptada e endurecida | O novo schema usa `organization_id`, atribuição explícita profissional–paciente, `clinical_access` e políticas por operação. |
| MFA | Padrão a reaproveitar depois | Não foi ativado sem projeto Auth. O requisito permanece para a homologação profissional. |
| Auditoria | Adaptada | Triggers novos registram ator, entidade, operação e nomes de campos não sensíveis, sem copiar conteúdo clínico. |
| Backup/migrations | Substituídos | Scripts do AtriaClinic são vinculados ao projeto antigo. O AtriaNutri começa com migration versionada própria. |
| Servidor/deploy | Não reutilizado | Não foram alteradas configurações de deploy existentes. A estratégia de hospedagem do AtriaNutri continua pendente. |

## Garantias de separação

- O AtriaNutri está no repositório independente `contato632/atrianutri`.
- Nenhum paciente, usuário, token, chave, configuração ou registro do AtriaClinic foi copiado.
- A referência do AtriaClinic existe no novo código somente em um bloqueio preventivo e em documentação/aviso de migration.
- A demonstração usa objetos fictícios com e-mails `.demo.local` e não executa chamadas de rede.
- A migration não foi aplicada a nenhum banco.
- O AtriaMind não foi clonado, consultado ou modificado.

## Pontos úteis do AtriaClinic para etapas futuras

1. Adaptar o fluxo de Auth/MFA após criar o projeto AtriaNutri.
2. Reimplementar agenda e recorrências sobre o novo `organization_id`.
3. Adaptar serviços e financeiro apenas com dados administrativos.
4. Criar Edge Functions próprias para convites, gestão de papéis e operações transacionais.
5. Reaplicar o rigor dos testes de backup e recuperação, sem reutilizar referências do projeto antigo.
