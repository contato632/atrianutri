# Qualidade e escopo de homologação

## Automação incluída

`npm run check` executa:

- cálculo e limites do IMC;
- interpretação contextual, sem diagnóstico automático;
- validação de pacientes e avaliações;
- criação/edição de pacientes no repositório de demonstração;
- separação do perfil clínico;
- criação de avaliação e cálculo do IMC;
- versões de rascunho do plano;
- confirmação server-side e conflitos do adaptador Supabase;
- restauração de sessão, exigência de MFA, logout e sessão expirada;
- validação do formulário de paciente;
- ausência de endpoint Supabase fixo, `service_role` e Web Storage;
- bloqueio preventivo do projeto AtriaClinic;
- presença de RLS e grants mínimos na migration;
- build TypeScript/Vite de produção.

O SQL de pgTAP em `supabase/tests/rls_isolation_test.sql` agora simula duas organizações, múltiplos papéis e pacientes. A tentativa com a pilha oficial foi feita com Supabase CLI 3.0.0 e Docker 29.9.2, sem projeto remoto, mas a imagem PostgreSQL não coube no armazenamento do executor (`no space left on device`).

Como validação independente, a migration foi aplicada integralmente em PostgreSQL 17 com stubs mínimos de autenticação. Um teste transacional real confirmou integridade referencial, isolamento RLS, escopo da recepção, bloqueio de autoelevação e concorrência otimista. A suíte pgTAP completa permanece pendente na pilha Supabase oficial.

## Cenários manuais da demonstração

1. Navegar nas cinco áreas em desktop e viewport mobile.
2. Buscar paciente por nome, telefone e e-mail; filtrar por estado.
3. Criar um paciente fictício e confirmar a tela de detalhe.
4. Editar telefone/status e confirmar a atualização da sessão.
5. Registrar peso/altura e conferir IMC, histórico e gráfico.
6. Adicionar refeição e itens manuais ao plano; salvar e conferir nova versão.
7. Recarregar a página e confirmar que alterações da sessão desaparecem, como informado.

## Itens que exigem infraestrutura antes de serem testados

- login, cadastro, recuperação, convites e MFA com contas reais de teste;
- persistência real e concorrência;
- allow/deny RLS entre duas organizações e múltiplos profissionais;
- compartilhamento de avaliação/plano com a conta do paciente;
- trilha de auditoria no banco;
- exclusão, retenção, backup e restauração;
- E2E em navegadores suportados e validação de cabeçalhos do host;
- acessibilidade completa com leitores de tela e navegação por teclado.
