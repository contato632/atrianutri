# Etapa 22 — Anamnese Nutricional Inteligente

## Estado da entrega

A anamnese nutricional passou a ter um fluxo estruturado, progressivo e versionado no prontuário do paciente. A implementação funciona no modo demonstrativo e possui contrato de persistência preparado para Supabase, mas a migration desta etapa **não foi aplicada local ou remotamente**. A persistência real continua bloqueada por `VITE_REAL_DATA_APPROVED=false` até a homologação da migration e de seus testes RLS.

## Fluxo profissional

O painel da anamnese fica no resumo do paciente e oferece:

- criação de anamnese inicial, atualização ou complementação;
- seis etapas: identificação e motivo, saúde, alimentação, rotina e hábitos, comportamento alimentar e sintomas gastrointestinais;
- indicação explícita para informação disponível, desconhecida ou não informada;
- origem individual de cada resposta: paciente, profissional ou relato revisado;
- salvamento de rascunho em qualquer etapa;
- revisão final antes da conclusão;
- notas clínicas privadas separadas das respostas;
- confirmação antes de descartar alterações não salvas;
- histórico com versões concluídas imutáveis.

Uma versão concluída nunca é sobrescrita. Qualquer complementação parte de uma versão anterior e gera a próxima versão. Existe no máximo um rascunho por paciente e organização.

## Separação de responsabilidades

- A anamnese registra informações relatadas e seu contexto; não confirma diagnósticos.
- Avaliações antropométricas e recordatórios já existentes continuam em seus módulos e são apenas referenciados no painel, evitando duplicação.
- Observações profissionais privadas ficam em `professional_private_notes` e são excluídas de documentos e compartilhamentos por padrão.
- O domínio fornece `authorizedAnamnesisSummary`, que somente retorna campos explicitamente autorizados e nunca inclui notas privadas.
- O Intelligence recebe eventos de versões concluídas e pode descrever mudanças textuais entre versões. Não classifica melhora, piora, adesão ou diagnóstico.

## Persistência e segurança preparadas

Migration local: `supabase/migrations/20261111140000_structured_nutrition_anamnesis.sql`.

Ela prepara:

- tabela `nutrition_anamneses` vinculada por chave composta a paciente e organização;
- autoria vinculada a membro da mesma organização;
- versões positivas e únicas por paciente;
- índice parcial que permite somente um rascunho aberto;
- RLS habilitado, com leitura restrita a quem possui acesso clínico ao paciente;
- ausência de `INSERT` e `UPDATE` diretos para o cliente;
- RPC `save_nutrition_anamnesis` com `SECURITY DEFINER`, `search_path` vazio, lock do paciente e conflito otimista para rascunhos;
- gatilhos de atualização e auditoria sensível;
- execução da RPC apenas por usuários autenticados.

O frontend consulta a tabela e usa a RPC somente quando o modo real estiver explicitamente aprovado. Até lá, o repositório demonstrativo mantém o mesmo contrato de rascunhos e versões em memória.

## Preparação para documentos e Portal do Paciente

Nenhuma informação da anamnese foi adicionada automaticamente a PDFs ou ao Portal. A função de resumo autorizado exige uma lista explícita de campos, preserva a origem de cada resposta e não expõe notas privadas. Isso permite uma integração futura com consentimento e seleção profissional, sem criar compartilhamento implícito nesta etapa.

## Testes executados

- Vitest completo: domínio, validação, histórico, repositórios demonstrativo e Supabase e contratos de segurança.
- Playwright direcionado: criação de rascunho, retomada, revisão, conclusão, histórico e viewport móvel de 390 px.
- Playwright de regressão direcionada: produtividade, Intelligence e anamnese.
- Build TypeScript/Vite.
- Auditoria visual em desktop e mobile.
- `git diff --check` e verificação de segredos antes do commit.

## Testes preparados, mas não homologados

O arquivo `supabase/tests/structured_anamnesis_rls_test.sql` contém sete asserções pgTAP para existência, RLS, privilégios e uso exclusivo da RPC.

A execução da pilha Supabase local foi tentada em 11 de novembro de 2026. O Docker não conseguiu concluir a extração da imagem PostgreSQL 17 por falta de espaço (`no space left on device`), portanto a stack não iniciou e os testes pgTAP desta migration **não foram executados**. Os contratos estáticos Vitest não substituem a homologação pgTAP.

Antes de qualquer aplicação remota é obrigatório:

1. iniciar uma pilha Supabase local descartável com espaço suficiente;
2. aplicar toda a sequência de migrations desde uma base vazia;
3. executar os testes pgTAP existentes e `structured_anamnesis_rls_test.sql`;
4. testar isolamento com duas organizações fictícias e papéis distintos;
5. revisar backup, restauração e critérios de interrupção;
6. obter autorização específica para qualquer alteração remota.

Nenhuma migration remota, deploy, chamada de IA externa ou habilitação de dados clínicos reais faz parte desta entrega.
