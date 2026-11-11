# AtriaNutri — Etapa 18: Clinical Intelligence com IA Generativa

## Resultado

Foi implementada a arquitetura funcional do assistente clínico generativo na rota profissional `/intelligence`, exclusivamente em **modo simulado**. A interface usa somente dados fictícios do workspace demonstrativo e não realiza chamadas a modelos, APIs ou serviços externos.

O objetivo desta etapa é validar contratos, limites clínicos, rastreabilidade, revisão humana, segurança e experiência de uso antes de qualquer integração real.

## Ferramentas disponíveis

1. **Analisar evolução** — organiza fatos documentados e diferenças matemáticas já calculadas no período.
2. **Preparar consulta** — reúne registros relevantes para revisão profissional antes do atendimento.
3. **Sugerir perguntas** — propõe perguntas abertas para investigação, sem concluir diagnóstico ou causa.
4. **Rascunhar resumo** — produz texto editável com fatos, tendências, investigação e limitações.

Todas as saídas são rascunhos. Nada é inserido automaticamente em prontuário, plano, documento ou comunicação com o paciente.

## Arquitetura

`src/ai/clinicalAssistant.ts` mantém a lógica independente de React:

1. `prepareAuthorizedClinicalContext` valida permissão clínica, organização, profissional e paciente permitido.
2. O contexto mínimo reúne apenas fontes do paciente e período selecionados.
3. `buildClinicalAiRequest` acrescenta instruções de sistema imutáveis e as seções escolhidas.
4. Um `ClinicalAiProvider` recebe o contrato; nesta etapa somente `SimulatedClinicalAiProvider` funciona.
5. `validateClinicalAiResponse` rejeita contrato inválido, referências inexistentes, fatos sem fonte e linguagem clínica autoritativa.
6. `UsageLedger` registra somente metadados de operação, sem conteúdo clínico.
7. A interface apresenta a resposta estruturada e um rascunho separado, integralmente editável.

O `InactiveAnthropicClinicalAiProvider` é apenas uma fronteira arquitetural. Ele falha de forma segura e não contém cliente HTTP, chave, variável secreta ou chamada de rede.

## Contratos e rastreabilidade

O contexto contém:

- versão do schema;
- paciente e organização autorizados;
- período;
- fontes clínicas mínimas com ID, tipo, data e link interno;
- cálculos determinísticos da Etapa 17.

A resposta contém quatro seções tipadas:

- informações documentadas;
- tendências observadas;
- pontos para investigação;
- limitações.

Fatos e tendências exigem ao menos uma referência válida. Toda referência é conferida contra os IDs do contexto autorizado. IDs inventados ou de outro escopo fazem a resposta inteira ser rejeitada. A interface liga as referências ao registro interno correspondente.

## Proteção contra alucinação e prompt injection

- O texto clínico é marcado como `untrusted-clinical-data`.
- Instruções encontradas em diário, avaliação ou acompanhamento permanecem dados e não alteram as instruções de sistema.
- O provedor recebe proibição explícita de executar comandos ou buscar recursos externos.
- Diagnóstico confirmado, prescrição automática, causalidade, prognóstico definido e tratamento indicado são rejeitados pelo validador.
- Relações temporais são apresentadas com limitação explícita de causalidade.
- Poucos registros geram limitações, não preenchimento por inferência.
- Falha, timeout e cancelamento não aplicam conteúdo parcial.

O filtro textual é uma camada adicional, não uma garantia suficiente para produção. Uma futura integração real deverá combinar schema estrito no backend, autorização novamente no servidor, validação semântica, avaliação adversarial e auditoria.

## Privacidade, autorização e LGPD

Entram no contexto apenas avaliações, medidas, diário, metas, check-ins e versões/publicações do plano do paciente autorizado. Ficam excluídos:

- registros de outros pacientes;
- financeiro e administração;
- observações profissionais privadas;
- notas privadas do diário;
- credenciais e dados de autenticação.

O contexto não é gravado em `localStorage`, `sessionStorage` ou IndexedDB. O ledger em memória contém somente request ID, organização, profissional, operação, modelo, estimativas de tokens, duração, estado, custo e timestamp. O rascunho é descartável e não persiste.

Em produção, minimização, finalidade, retenção, base legal, transparência, atendimento dos direitos do titular e processo para incidentes deverão ser homologados com a governança LGPD.

## Revisão humana

O profissional pode:

- escolher ferramenta e seções;
- cancelar a operação;
- abrir fontes;
- editar todo o rascunho;
- marcar o texto como revisado;
- copiar o conteúdo;
- descartar sem alterar o prontuário.

Qualquer edição remove a marca de revisão. A marca existe apenas na sessão e não equivale a assinatura, registro clínico ou aprovação persistida.

## Uso e custo

O modo simulado estima tokens localmente para exercitar observabilidade. O custo é sempre **R$ 0,00**. Existe limite demonstrativo por par organização/profissional e registro de sucesso, erro ou cancelamento.

Não há faturamento, consumo de API, transmissão de dado clínico ou credencial configurada.

## Caminho futuro para provedor real

Uma integração externa somente poderá ser ativada após autorização específica e deverá:

1. existir exclusivamente em backend homologado;
2. manter credenciais em segredo do servidor;
3. refazer Auth, MFA, vínculo, papel e escopo organizacional a cada operação;
4. enviar o contexto mínimo e impedir logging de conteúdo pelo fornecedor;
5. exigir contrato estruturado e validar todas as referências;
6. aplicar timeout, cancelamento, limite, observabilidade e circuit breaker;
7. registrar auditoria sem conteúdo clínico desnecessário;
8. concluir avaliação de fornecedor, tratamento de dados, região, retenção, backup e LGPD;
9. manter o modo simulado e um fallback determinístico;
10. exigir revisão profissional antes de qualquer persistência ou compartilhamento.

O frontend nunca deverá receber chave de provedor. O adaptador Anthropic atual permanece propositalmente inativo.

## Testes cobertos

Os testes unitários verificam contexto mínimo, isolamento de paciente, permissão clínica, exclusão de privado/financeiro, prompt injection, quatro ferramentas, referências inventadas, fatos sem fonte, linguagem proibida, metadados sem conteúdo, limite por escopo, timeout, cancelamento, falha de provedor, adaptador inativo e imutabilidade do workspace.

Os testes Playwright verificam geração estruturada, ausência de requisições externas, referências navegáveis, custo zero, quatro ferramentas, seleção de seções, edição, revisão, descarte, cancelamento e responsividade móvel.

Resultados finais executados em 10/11/2026:

- Vitest: **152 testes aprovados em 22 arquivos**;
- Playwright/Chromium: **35 fluxos aprovados**, quatro específicos desta etapa;
- TypeScript/Vite: **build de produção aprovado**;
- `git diff --check`: **aprovado**;
- varredura estática desta implementação: nenhuma chamada HTTP, chave, segredo ou armazenamento persistente do contexto clínico.

## Limitações e pendências

- A geração atual é determinística e simulada; não representa a qualidade de um modelo real.
- Uso, revisão e rascunho vivem somente na memória da sessão.
- Não há persistência, assinatura, inclusão automática em PDF ou envio ao paciente.
- Não há credencial, backend de inferência ou chamada externa.
- O gate de dados reais continua desabilitado.
- Nenhuma migration foi criada ou aplicada.
- A ativação real depende de homologação técnica, clínica, segurança, fornecedor, backup/restauração e LGPD, além de autorização posterior explícita.
