# Etapa 09 — Central de documentos e relatórios em PDF

## Documentos implementados

A rota `/documentos` reúne quatro documentos gerados localmente:

1. **Relatório de Avaliação Nutricional** — avaliação selecionada, contexto relatado, rotina, recordatório e antropometria existente.
2. **Relatório de Evolução Nutricional** — resumo temporal, gráfico vetorial de peso/cintura, histórico de medidas e metas.
3. **Plano Alimentar** — refeições, itens e orientações da versão explicitamente selecionada.
4. **Resumo de Acompanhamento** — contexto, avaliações recentes, metas, progresso e atendimentos nutricionais.

Nenhum documento cria diagnóstico, recomendação, prescrição, assinatura ou dado inexistente. Campos ausentes são identificados como não informados.

## Editor e identidade profissional

O profissional seleciona paciente, fonte e seções, além de editar título, abertura e observações finais. Cabeçalho, rodapé, nome da clínica, cor, nome do nutricionista e CRN são configuráveis somente na sessão. Nome profissional e CRN são obrigatórios para gerar o arquivo.

Observações profissionais restritas ficam desmarcadas por padrão. Notas privadas do diário, metas e anamnese nunca entram no modelo de documento. A rota exige acesso clínico ativo no modo Supabase e continua subordinada às políticas RLS que carregam o workspace.

## PDF e paginação

O `jsPDF` é carregado sob demanda somente ao abrir a Central. Texto, tabelas e gráfico são desenhados no navegador, sem upload ou serviço externo. O compositor usa A4 em milímetros, margens reservadas, cabeçalho e rodapé em todas as páginas, contador de páginas e quebra controlada de textos e linhas longas.

A pré-visualização usa o próprio Blob PDF. O download permanece desabilitado quando o editor diverge da prévia e utiliza exatamente o arquivo revisado. Nenhum conteúdo clínico é armazenado no navegador, em Web Storage ou em serviço terceiro.

## Validação automatizada

- construção dos quatro documentos a partir do workspace;
- exclusão de notas privadas e opt-in para observações restritas;
- seleção real das versões do plano;
- obrigatoriedade de identificação profissional e CRN;
- assinatura `%PDF`, dimensões A4, gráfico e paginação de conteúdo extenso;
- geração sem `fetch`, `XMLHttpRequest` ou endpoint externo;
- prévia, download, seleção de versão e responsividade em Chromium.

Não foi criada migration nesta etapa. As migrations 05–08 permanecem apenas versionadas e validadas localmente; não houve aplicação remota, deploy ou merge.
