# Etapa 08 — Financeiro do consultório

## Entrega funcional

A rota `/financeiro`, acessível pela Gestão, reúne indicadores de receita efetivamente recebida, saldo a receber, vencidos, previsões, despesas pagas/previstas e saldo operacional. Previsões nunca são somadas à receita recebida. A evolução mensal utiliza apenas movimentos efetivos.

Cobranças podem ser vinculadas a consultas e retornos ou criadas de forma avulsa. O preço do serviço é copiado em centavos no momento da criação e não acompanha alterações futuras do serviço. Um índice parcial impede mais de uma cobrança ativa por agendamento.

Recebimentos aceitam pagamento integral, parcial e parcelamento manual, com Pix, dinheiro, cartões, transferência ou outro meio. Estornos são novos movimentos compensatórios; nenhum pagamento é apagado. Despesas distinguem competência, vencimento, previsão, pagamento efetivo e cancelamento.

O perfil do paciente exibe um bloco administrativo financeiro separado da anamnese, avaliações e diário alimentar. A visibilidade real continua condicionada à RLS financeira.

## Persistência e segurança

A migration review-only `20261108230000_office_finance.sql` adiciona permissões financeiras explícitas, cobranças, pagamentos, categorias, despesas e auditoria sem conteúdo clínico. Valores são `bigint` em centavos. RPCs transacionais usam locks, idempotência e conflito otimista; impedem recebimento acima do saldo, cobrança duplicada por agendamento e cancelamento com recebimento líquido.

Matriz proposta:

- proprietário: gestão financeira integral da própria organização;
- administrador: somente com permissão financeira explícita;
- recepção: somente com permissão operacional explícita, sem despesas e relatórios globais;
- nutricionista: nenhum acesso automático por autorização clínica;
- paciente: nenhum acesso ao financeiro profissional.

## Validação desta etapa

- Vitest cobre cálculos, vencimentos, parcial, integral, estorno, duplicidade, concorrência simulada e adapters;
- Playwright cobre cobrança, recebimento, despesa e responsividade;
- contratos estáticos verificam RLS, grants mínimos, centavos, idempotência e ausência de exclusão física;
- a sequência completa de sete migrations foi reaplicada na pilha Supabase local e os 123 testes pgTAP, incluindo o financeiro, foram aprovados.

Não houve migration remota, deploy, merge, gateway financeiro, transação bancária real ou uso de dados reais. As migrations 05–08 permanecem pendentes de homologação remota, backup e restauração.
