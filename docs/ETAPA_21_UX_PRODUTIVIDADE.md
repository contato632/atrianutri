# AtriaNutri — Etapa 21: UX Premium e Produtividade Profissional

## Escopo e segurança

Esta etapa melhora a produtividade do nutricionista sem criar módulos, alterar regras clínicas ou modificar a identidade premium. O trabalho permaneceu exclusivamente no frontend e no modo demonstrativo.

Não foram alterados Supabase remoto, migrations, RLS, cálculos nutricionais, PDFs, assinaturas, integração Anthropic ou configuração da Hostinger. `VITE_REAL_DATA_APPROVED` continua bloqueado por padrão.

## Auditoria de UX

Foram revisados Início, Pacientes, Agenda, Avaliações, Planos alimentares, Documentos, Gestão, Intelligence Nutricional e Portal do Paciente. Os principais problemas encontrados foram:

- perda do paciente em contexto ao alternar entre módulos;
- seletores de paciente repetidos e sem sincronização;
- filtros de pacientes limitados e sem ordenação explícita;
- pendências do dashboard com textos fixos, não derivadas dos registros;
- contagem de próximas consultas limitada aos três itens exibidos;
- descarte silencioso de alterações em cadastro, agenda e planos;
- agenda sem foco rápido no paciente em atendimento;
- controles adicionais sem composição compacta para celular.

O Portal do Paciente foi mantido isolado da jornada profissional. Sua navegação móvel, estados vazios e regras de acesso existentes foram revisados e não exigiram mudança estrutural nesta etapa.

## Soluções implementadas

### Jornada centrada no paciente

- Contexto de paciente compartilhado entre cadastro, avaliações, planos, Intelligence, documentos e agenda.
- Barra compacta com resumo, avaliações, plano, evolução, documentos e agenda.
- Seleção preservada somente em memória durante a navegação, sem armazenar identificadores clínicos no navegador.
- Validação da seleção contra os pacientes já carregados no escopo autorizado.
- Troca de paciente sincronizada nos seletores internos dos módulos.
- Agenda pode alternar entre o paciente atual e todos os compromissos.
- Novos agendamentos iniciados a partir da jornada já recebem o paciente atual.

### Busca e produtividade

- Busca de pacientes por nome, telefone ou e-mail.
- Filtro por estado de acompanhamento.
- Ordenação por atualização/cadastro recente, ordem alfabética ou próxima consulta.
- Limpeza conjunta e visível dos filtros.
- Controles recompostos para ocupar a largura disponível sem rolagem da página.

### Formulários e feedback

- Campos obrigatórios explicitados no cadastro administrativo.
- Estado de alterações pendentes comunicado no formulário.
- Botão de atualização desabilitado quando um cadastro existente não foi alterado.
- Confirmação antes de descartar cadastro, agendamento ou plano editado.
- Proteção do editor de plano também no fechamento/recarregamento da página.
- Estados de salvamento e erros contextuais existentes foram preservados.
- Mensagens continuam deixando explícito que alterações da demonstração não são persistidas permanentemente.

### Dashboard e agenda

- Próximas consultas agora são calculadas a partir de agendamentos existentes e a métrica mostra a contagem completa.
- Pendências são derivadas de planos em rascunho e pacientes ativos sem avaliação registrada.
- Nenhuma pendência clínica é inventada.
- Itens acionáveis levam ao módulo correto mantendo o paciente em contexto.
- Agenda mantém recorrência, conflitos, privacidade e regras de cancelamento já existentes.

### Experiência mobile e acessibilidade

- Jornada do paciente recomposta em duas linhas no tablet/celular, com atalhos roláveis dentro do próprio componente.
- Alvos de toque compactos, mas adequados, e controles com rótulos acessíveis.
- Filtros passam a ocupar uma coluna em telas estreitas.
- Sidebar premium desktop, drawer e navegação inferior foram preservados.
- Auditoria em 360, 390, 430, 768 e 1024 px sem rolagem horizontal do documento.
- Foco visível e preferência por movimento reduzido permanecem ativos.

## Validação executada

- Build TypeScript/Vite: aprovado.
- Vitest completo: 184 testes em 25 arquivos aprovados, incluindo contrato de segurança.
- Playwright direcionado: 27 testes aprovados após correção e reexecução do cenário afetado; 4 deles são específicos da Etapa 21.
- Jornada do paciente, filtros combinados, persistência da seleção e responsividade: aprovados.
- Auditoria visual real: telas de detalhe do paciente em 390 px e editor de planos em 1440 px inspecionadas.
- `git diff --check`: aprovado.

Os testes pgTAP não fazem parte desta etapa de frontend e não foram executados nem declarados homologados.

## Limites conhecidos

- A seleção é preservada somente durante a navegação atual e dentro da organização ativa; ela não é armazenada no navegador nem persistida no banco.
- O estado demonstrativo continua em memória e pode ser perdido ao recarregar, conforme informado na interface.
- Nenhuma integração externa de mensagens foi adicionada à agenda.
