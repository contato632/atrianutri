# AtriaNutri — Etapa 15: Portal do Paciente

## Resultado

Foi implementado um portal responsivo e funcional para a conta fictícia de Ana Beatriz Lima. O portal reutiliza o workspace do AtriaNutri, mas sua projeção de dados e suas operações de escrita são separadas do acesso profissional.

O fluxo real com Supabase permanece bloqueado. A demonstração não é apresentada como autenticação de produção e não persiste sessão ou dados clínicos no navegador.

## Acesso demonstrativo

- Rota: `/portal`.
- Conta: `ana.exemplo@demo.local`.
- Código: `ATRIA-DEMO`.
- O estado de sessão existe somente na memória do componente.
- A recuperação informa explicitamente que nenhum e-mail foi enviado.
- O acesso profissional continua separado e disponível pela rota principal.
- Não há links públicos com tokens ou informações clínicas.

O contrato `authenticateDemoPatient` aceita somente a conta fictícia vinculada. Ele existe para validar navegação e permissões da demonstração, não para substituir Supabase Auth.

## Funcionalidades implementadas

### Página inicial

- Saudação personalizada.
- Próxima consulta futura vinculada ao paciente.
- Identificação do plano disponibilizado.
- Metas compartilhadas.
- Registros recentes do diário.
- Atalhos para plano, diário e metas.

### Meu plano alimentar

- Exibe somente plano com status `active`.
- Mostra a versão disponibilizada, refeições, horários, alimentos, quantidades, orientações e substituições previamente aprovadas.
- Exibe medidas caseiras quando presentes no snapshot do alimento.
- Identifica a nutricionista e o CRN fictício.
- Não oferece edição, criação de substituição ou alteração da prescrição.
- Não apresenta composição demonstrativa como evidência científica.

### Diário alimentar

- Registra data, horário, refeição, alimento, quantidade relatada, observações e dificuldades.
- A operação `savePatientFoodDiaryEntry` força `source = patient`, elimina nota profissional privada e valida que o identificador do registro coincide com o paciente autenticado.
- O consumo relatado é identificado separadamente da prescrição.
- Não há julgamento ou pontuação automática.

### Metas e hábitos

- Exibe somente metas explicitamente compartilhadas pelo profissional.
- Permite acompanhamento descritivo do paciente.
- `savePatientHabitCheckIn` valida paciente, meta e compartilhamento antes de gravar.
- Não cria metas clínicas e não classifica moralmente alimentos ou comportamento.

### Evolução

- Gráfico baseado exclusivamente nas avaliações existentes e registradas pelo profissional.
- Legenda diferencia medidas profissionais de informações relatadas pelo paciente.
- Notas clínicas das avaliações não integram a projeção do portal.
- Não infere melhora, piora, sucesso ou fracasso.

## Arquitetura e isolamento

`patientPortalSnapshot(workspace, patientId)` cria uma projeção mínima e imutável para o portal. Ela inclui apenas:

- identificação básica do próprio paciente;
- próxima consulta clínica do próprio paciente, sem notas administrativas;
- plano ativo do próprio paciente;
- diário de autoria do paciente ou explicitamente compartilhado;
- metas compartilhadas e acompanhamentos correspondentes;
- avaliações do próprio paciente sem notas clínicas;
- identificação profissional necessária ao cuidado.

Ela exclui por construção:

- outros pacientes;
- anamnese e observações profissionais;
- notas privadas do diário, metas e acompanhamentos;
- compromissos particulares;
- informações financeiras e administrativas;
- avaliações nutricionais completas e recordatórios não destinados ao portal.

O repositório demonstrativo possui comandos específicos para autoria do paciente e rejeita escrita cruzada. O repositório Supabase implementa o mesmo contrato, mas retorna bloqueio explícito até a homologação das políticas específicas do portal.

## Integração profissional

- Um plano `active` representa a versão disponibilizada; rascunhos não aparecem.
- Registros criados no portal entram no workspace com origem `patient` e ficam disponíveis nos módulos profissionais existentes durante a mesma sessão demonstrativa.
- A autoria permite identificar registros novos do paciente sem confundi-los com registros profissionais.
- O vínculo fictício possui estado ativo no contrato de acesso.

A suspensão real de vínculo, convites individuais, publicação independente de versões e notificações de novos registros dependem da próxima migration e das RPCs de paciente. Esses controles não foram simulados como se já estivessem homologados.

## Contrato futuro com Supabase

Nenhuma migration foi criada nesta etapa porque a implementação segura exige definir em conjunto:

1. identidade Auth do paciente;
2. vínculo entre `auth.uid()`, paciente, organização e profissional;
3. ciclo de convite, aceite, suspensão e revogação;
4. versão específica do plano publicada;
5. RPCs restritas para relatos do paciente;
6. políticas RLS que nunca dependam de identificador enviado pelo navegador;
7. auditoria de acesso e revogação.

Criar apenas tabelas ou políticas parciais daria uma falsa garantia de segurança. Até essa estrutura ser implementada e validada com duas organizações fictícias, `SupabaseNutritionRepository` bloqueia as operações do portal e `VITE_REAL_DATA_APPROVED` continua inalterada.

## Privacidade e armazenamento

- Nenhum token é escrito em logs.
- Não foi usado `localStorage`, `sessionStorage` ou IndexedDB.
- Nenhum serviço externo recebe dados clínicos.
- A sessão demonstrativa e suas alterações existem apenas em memória.
- O portal não consulta cobranças, pagamentos, despesas ou notas administrativas.
- Todos os dados de demonstração são fictícios.

## Acessibilidade e responsividade

- Navegação específica do paciente no desktop e barra inferior no celular.
- Textos e botões em português brasileiro.
- Controles rotulados e estados de carregamento, erro, vazio e ausência de vínculo.
- Gráfico com nome acessível e pontos descritivos.
- Layout validado em viewport de 390 × 844 sem rolagem horizontal.

## Testes executados

- Vitest completo: **127 testes aprovados em 19 arquivos**.
- Playwright completo: **23 fluxos aprovados**, incluindo cinco fluxos específicos do portal.
- Build TypeScript/Vite: aprovado.
- `git diff --check`: aprovado.

Os testes específicos cobrem entrada fictícia, rejeição de outra conta, isolamento do paciente, remoção de notas privadas, plano somente leitura, gravação do diário, acompanhamento de meta, recuperação demonstrativa, evolução e responsividade mobile.

## Limitações e próximos passos

- Autenticação real, convite, recuperação, MFA e revogação aguardam contrato Supabase específico do paciente.
- O portal real permanece bloqueado mesmo que o ambiente profissional seja aprovado.
- Suspensão do vínculo e publicação de uma versão específica precisam de migration, RLS, RPCs e auditoria pgTAP antes de qualquer aplicação remota.
- A identificação profissional da demonstração é fictícia e claramente rotulada.
- Nenhum dado real deve ser utilizado antes da homologação de segurança, backup e restauração.
