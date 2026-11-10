# AtriaNutri — Etapa 19: backend seguro de IA clínica

## Resultado e estado de ativação

Foi criada a infraestrutura local e versionada para uma integração futura do Clinical Intelligence com Claude. O modo demonstrativo continua sendo o único modo funcional no frontend. O modo real permanece bloqueado por código, configuração, ausência de credencial e ausência de cotas remotas.

Nenhuma chamada à Anthropic foi executada. Nenhuma migration foi aplicada remotamente e nenhum dado real foi utilizado.

## Decisão arquitetural

A integração futura utiliza uma Supabase Edge Function autenticada, separada do frontend:

```text
Frontend autenticado
  -> envia somente organização, paciente, período, ferramenta e seções
  -> Edge Function valida JWT, membro, acesso clínico e vínculo ativo
  -> consultas clínicas usam o cliente RLS do próprio usuário
  -> contexto mínimo é normalizado e validado no servidor
  -> service role é usado somente para reservar/reconciliar metadados de cota
  -> adaptador Anthropic no backend
  -> resposta estruturada é verificada antes de retornar
  -> profissional revisa e edita; nada é salvo automaticamente
```

O frontend não prepara nem envia o contexto clínico ao provedor. Também não recebe chave, preço, modelo privilegiado ou permissão administrativa.

## Fontes oficiais consultadas

Em 10/11/2026, os domínios de documentação estavam bloqueados pela política de rede do executor. Foram consultadas as fontes oficiais mantidas no GitHub:

- `anthropics/anthropic-sdk-typescript`: SDK oficial, suporte a Deno e orientação de uso server-side; o uso em navegador é desabilitado por padrão para evitar exposição da chave.
- `supabase/supabase`, guia `Securing Edge Functions`: autenticação `user`, JWT verificado, cliente RLS-scoped e risco explícito de usar cliente administrativo em dados compartilhados.

Modelos, preços e versão de API não foram fixados. Todos são configuração de backend e precisam ser novamente conferidos na documentação oficial antes da ativação.

## Edge Function

`supabase/functions/clinical-intelligence/index.ts` usa autenticação de usuário e mantém `verify_jwt = true`.

Para cada chamada, a função:

1. aceita somente `POST` autenticado;
2. exige sessão com MFA/AAL2 e valida UUIDs, ferramenta, seções e período máximo de 366 dias;
3. confirma membro ativo com papel clínico;
4. confirma atribuição profissional ativa ao paciente;
5. consulta os registros com o cliente RLS do usuário;
6. não consulta a tabela administrativa do paciente;
7. prepara e limita o contexto;
8. reserva cota antes de chamar o provedor;
9. valida a resposta e reconcilia consumo;
10. retorna erro genérico sem conteúdo clínico.

O cliente administrativo fica limitado às RPCs de metadados de cota. Dados clínicos são lidos somente pelo cliente sujeito a RLS.

## Contrato de entrada

O navegador pode enviar apenas:

- request ID e chave de idempotência;
- organização e paciente;
- ferramenta existente;
- seções solicitadas;
- período.

O contrato não aceita contexto clínico, permissões, tokens, custo, modelo, chave Anthropic ou resultado previamente calculado. Todos os identificadores e permissões são revalidados no backend.

As quatro ferramentas existentes são aceitas: análise longitudinal, preparação de atendimento, perguntas de investigação e resumo clínico.

## Adaptador Anthropic

O adaptador reside apenas no backend e suporta:

- endpoint oficial de Messages;
- modelo configurado por ambiente;
- versão explícita da API;
- limite de saída;
- timeout e cancelamento;
- falhas HTTP e respostas vazias;
- usage retornado pelo provedor;
- custo estimado com preços configurados no backend;
- resposta JSON estruturada.

Variáveis previstas:

- `CLINICAL_AI_REAL_MODE=enabled`;
- `ANTHROPIC_API_KEY`;
- `ANTHROPIC_MODEL`;
- `ANTHROPIC_API_VERSION`;
- `ANTHROPIC_MAX_OUTPUT_TOKENS`;
- `ANTHROPIC_TIMEOUT_MS`;
- `ANTHROPIC_INPUT_MICROS_PER_MILLION`;
- `ANTHROPIC_OUTPUT_MICROS_PER_MILLION`.

Sem todas as configurações válidas, o adaptador falha de forma segura. A chave nunca deve usar prefixo `VITE_` nem ser disponibilizada ao navegador.

## Autorização e revogação

A autorização real exige simultaneamente:

- JWT válido;
- membro ativo na organização informada;
- papel `owner` ou `nutritionist`;
- `clinical_access = true`;
- atribuição ativa ao paciente na mesma organização.

Uma atribuição revogada bloqueia novas reservas. Um profissional de outra organização não consegue reservar cota nem consultar contexto pelo cliente RLS.

## Minimização do contexto

O backend seleciona somente campos necessários de avaliações, medidas, diário, metas e acompanhamentos no período. São removidos recursivamente:

- nome e data de nascimento;
- CPF/documentos;
- e-mail e telefone;
- endereço;
- auth user ID;
- observações profissionais privadas;
- notas privadas.

Dados financeiros e administrativos não são consultados. Textos são limitados, caracteres de controle são removidos, HTML/script é neutralizado, arrays e profundidade são limitados e o payload total possui teto de fontes e bytes.

A minimização não substitui base legal, contrato, transparência e avaliação de impacto.

## Tendências determinísticas

Medidas brutas autorizadas geram fontes determinísticas separadas contendo primeiro valor, último valor, diferença aritmética, intervalo e referências originais. O modelo não calcula nem substitui essas tendências.

Uma afirmação numérica factual só é aceita quando:

- aponta para uma fonte autorizada;
- informa caminho e valor existentes;
- usa unidade permitida;
- todos os números e datas do texto aparecem nas evidências;
- a seção e o tipo de afirmação correspondem.

Valores antropométricos ou nutricionais inventados são rejeitados.

## Validação, alucinação e prompt injection

Informações clínicas são marcadas como não confiáveis. Elas nunca são interpretadas como comandos. O contrato não permite ferramentas, alteração de plano ou acesso externo.

O validador rejeita:

- estrutura ou request ID divergente;
- seção ausente;
- referência fora do contexto;
- fato/tendência sem evidência;
- evidência cujo valor não corresponde ao registro;
- número, data ou unidade inventados;
- hipótese apresentada como fato;
- linguagem de diagnóstico/prescrição/causalidade;
- scripts, handlers HTML e protocolos maliciosos.

Referências válidas não tornam uma afirmação clinicamente correta. A revisão profissional continua obrigatória.

## Cotas, concorrência e custo

A migration local cria `clinical_ai_usage_limits` e `clinical_ai_operations`.

- clientes `anon` e `authenticated` não recebem acesso direto;
- somente o backend com `service_role` executa reserva/reconciliação;
- as funções usam `SECURITY INVOKER`, não `SECURITY DEFINER`;
- a linha de limite é bloqueada com `FOR UPDATE` para serializar concorrência;
- reserva considera requisições, entrada, saída e custo máximo;
- idempotência impede consumo duplicado;
- erro ou cancelamento libera a reserva da contabilização futura;
- sucesso reconcilia usage real;
- logs e tabelas guardam somente metadados, nunca prompt ou resposta clínica.

Não existe cobrança financeira nesta etapa.

## Revisão profissional e interface

O frontend identifica claramente “Modo simulado” e “Integração real bloqueada”. O gateway remoto existe, mas vem desabilitado e não é instanciado pelo fluxo demonstrativo.

O profissional seleciona ferramenta e seções, acompanha processamento, pode cancelar, consulta fontes, edita e marca o resultado. A revisão fica vinculada ao request ID. Qualquer edição remove a revisão. A cópia só é habilitada depois da confirmação.

Nenhuma resposta modifica prontuário, plano, meta, avaliação, orientação ou documento.

## Segurança e LGPD

Antes de dados reais, é necessária avaliação jurídica e de privacidade específica sobre:

- finalidade, necessidade e proporcionalidade;
- categorias de dados pessoais sensíveis;
- papéis de controlador, operador e suboperadores;
- base legal aplicável, sem presumir consentimento como única opção;
- contrato, retenção, exclusão e uso secundário pelo fornecedor;
- transferência internacional e localização do processamento;
- transparência para profissional e paciente;
- direitos dos titulares e resposta a incidentes;
- RIPD/DPIA e riscos clínicos;
- backup, restauração, observabilidade e auditoria.

## Testes

Testes Vitest direcionados cobrem validação de entrada, autorização negada, revogação, isolamento organizacional, minimização, limites de contexto, tendências determinísticas, referências, números/unidades inventados, HTML, linguagem clínica proibida, configuração bloqueada, custo, transporte inativo, timeout/cancelamento, falha simulada, cota concorrente, idempotência, quatro ferramentas e ausência de mutação clínica.

O Playwright direcionado cobre identificação do modo, geração simulada, referências, seleção de seções, revisão vinculada, cópia bloqueada antes da revisão, descarte, cancelamento e responsividade.

Resultados executados em 10/11/2026:

- Vitest completo: **170 testes aprovados em 24 arquivos**;
- Playwright direcionado: **4 fluxos aprovados**;
- TypeScript/Vite: **build de produção aprovado**;
- bundle estático da Edge Function: **aprovado**;
- sequência completa das migrations em PostgreSQL 17 descartável: **aprovada**;
- verificação SQL de RLS, `SECURITY INVOKER` e grants da Etapa 19: **aprovada**;
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades encontradas**;
- `git diff --check`: **aprovado**.

`supabase/tests/clinical_ai_backend_rls_test.sql` cobre RLS, grants, ausência de execução pelo cliente, `SECURITY INVOKER`, cota, idempotência, reconciliação, revogação e isolamento. O arquivo foi preparado, mas o pgTAP não foi executado: a pilha local não conseguiu extrair a imagem oficial por falta de espaço no daemon. Este resultado não é contado como aprovado.

## Pendências para ativação controlada

1. Reconsultar documentação oficial Anthropic/Supabase e fixar versões homologadas.
2. Revisar e aplicar a migration somente após autorização remota específica.
3. Executar pgTAP integral em Supabase local descartável com espaço suficiente.
4. Configurar cotas iniciais administrativamente; ausência de cota deve continuar negando uso.
5. Guardar segredos somente no backend e testar rotação/revogação.
6. Avaliar fornecedor, região, retenção, transferência internacional e LGPD.
7. Executar testes adversariais e avaliação clínica com dados integralmente fictícios.
8. Homologar Auth, MFA, RLS, backup/restauração, observabilidade e resposta a incidentes.
9. Autorizar explicitamente a ativação; só então definir `CLINICAL_AI_REAL_MODE=enabled`.
10. Manter rollback imediato para o modo simulado.

## Consolidação futura

Título sugerido da PR: **AtriaNutri — Intelligence Nutricional e backend seguro de IA clínica (Etapas 17–19)**

Descrição sugerida: motor longitudinal determinístico, assistente clínico simulado e infraestrutura protegida para integração futura com Claude, incluindo autorização server-side, minimização, validação de evidências, cotas atômicas, testes e documentação. Sem ativação real, credenciais, deploy ou migrations remotas.
