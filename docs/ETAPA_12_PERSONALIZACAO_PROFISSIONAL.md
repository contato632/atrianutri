# Etapa 12 — personalização profissional e identidade dos documentos

Implementação local concluída em 9 de novembro de 2026 sobre o commit preservado `2e1db361277111b979a208eb9e23bc5354a10914`. Nenhuma migration remota, publicação, alteração de produção ou push foi executado.

## Funcionalidades implementadas

- Cadastro único, na Central de Documentos, de nome profissional, CRN, clínica/consultório, telefone, e-mail, endereço opcional, cor principal, complemento de cabeçalho, rodapé e preferência de exibição dos contatos.
- Pré-visualização responsiva da identidade em proporção A4, atualizada enquanto os campos são editados.
- Reutilização automática da identidade nos quatro documentos existentes: Avaliação Nutricional, Evolução Nutricional, Plano Alimentar e Resumo de Acompanhamento.
- Cabeçalho, identificação profissional, cor de destaque, contatos opcionais e rodapé aplicados pelo mesmo gerador local usado na prévia e no download.
- Validação obrigatória do nome profissional e do CRN no formato `CRN-5 12345` antes da emissão. Nenhum nome, CRN, diagnóstico, recomendação ou assinatura é inferido ou criado pelo sistema.
- Personalização opcional por documento em uma cópia independente. Alterar essa cópia não modifica as preferências gerais da sessão.
- Mensagem explícita de que, no modo demonstração, o salvamento é temporário e termina com a sessão.

## Persistência e isolamento

Foi criado o contrato `DocumentPreferencesRepository`, com operações de leitura e gravação delimitadas pelo par `organizationId` + `professionalId`. A implementação atual, `SessionDocumentPreferencesRepository`, utiliza somente um `Map` em memória:

- não usa `localStorage`, `sessionStorage`, IndexedDB, cookies ou serviço externo;
- não persiste dados pessoais ou profissionais após o encerramento da sessão;
- devolve cópias dos registros para impedir mutação acidental do padrão geral;
- isola preferências entre profissionais e entre organizações;
- permite substituir futuramente o adaptador de memória por um adaptador Supabase, após migration, RLS e homologação específicos.

Nenhuma migration foi criada nesta etapa porque a persistência remota continua proibida e uma tabela sem uso homologado ampliaria desnecessariamente a superfície de dados.

## Segurança preservada

- PDFs continuam sendo montados inteiramente no navegador, sem envio de conteúdo clínico a terceiros.
- O download continua bloqueado quando a prévia não corresponde exatamente às opções atuais.
- Notas privadas permanecem excluídas; conteúdo clínico restrito continua exigindo seleção explícita.
- A autorização clínica da Central de Documentos não foi relaxada.
- Os contatos profissionais são exibidos somente quando a opção correspondente está ativa.
- O preenchimento automático do nome a partir de avaliações foi removido.

## Validações executadas

- `npx vitest run src/domain/documents.test.ts src/data/documentPreferences.test.ts`: 2 arquivos e 9 testes aprovados.
- `npx playwright test e2e/responsive.spec.ts --grep 'documentos|plano na versão|personalização individual'`: 3 fluxos aprovados em Chromium, incluindo desktop, mobile, PDF e independência da personalização individual.
- `npm run build`: TypeScript e build Vite aprovados.
- `git diff --check`: aprovado, sem erros de whitespace.

Os testes unitários cobrem os quatro documentos, geração A4, paginação, gráfico, versão do plano, exclusão de notas privadas, validação do CRN, isolamento de organização/profissional e cópias independentes. Os testes de navegador cobrem salvamento/reutilização da identidade, prévia A4 responsiva, download do plano e ausência de estouro horizontal no celular.

## Arquivos principais

- `src/components/ProfessionalDocumentSettings.tsx`: formulário e prévia A4 da identidade.
- `src/data/documentPreferences.ts`: contrato preparado para persistência futura e adaptador temporário de sessão.
- `src/state/DocumentPreferencesContext.tsx`: escopo ativo e integração React.
- `src/domain/documents.ts`: campos de identidade, padrões e validação de CRN.
- `src/lib/nutritionPdf.ts`: aplicação segura da identidade em cabeçalho e rodapé A4.
- `src/pages/DocumentsPage.tsx`: carregamento automático dos padrões e override individual.
- `src/styles.css`: experiência responsiva e acessível.
- `src/domain/documents.test.ts`, `src/data/documentPreferences.test.ts` e `e2e/responsive.spec.ts`: cobertura direcionada.

## Pendências para homologação remota

- Definir e revisar a tabela de preferências profissionais, seus campos mínimos e política de retenção.
- Criar migration complementar versionada, sem modificar migrations aplicadas, somente quando a persistência remota for autorizada.
- Implementar RLS que vincule leitura e escrita ao usuário profissional e à organização ativa, com testes de duas organizações e papéis distintos.
- Executar backup/restauração verificável e homologar RLS/Auth antes de trocar o adaptador em memória.
- Manter `VITE_REAL_DATA_APPROVED=false` até autorização separada para dados reais.

## Publicação

O comportamento de auto-deploy da Hostinger continua tratado como potencialmente ativo. Por isso, esta entrega foi mantida exclusivamente no repositório local, sem push e sem deploy manual.
