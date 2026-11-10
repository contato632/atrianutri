# AtriaNutri — Etapa 06: avaliação nutricional completa

Entrega implementada na PR #1 sem merge, deploy ou alteração do Supabase remoto.

## Escopo funcional

- avaliação clínica estruturada em grupos recolhíveis para histórico, contexto e rotina alimentar;
- objetivo reutilizado da anamnese existente, sem campo duplicado;
- antropometria reutilizada de `nutrition_assessments`, com gráfico de peso e cintura;
- recordatório retrospectivo de 24 horas separado explicitamente do Diário Alimentar contínuo;
- evolução consolidada com avaliações, antropometria, hábitos e versões do plano, filtrável por período;
- resumo profissional com campos ausentes explícitos, data, autoria e navegação para as fontes;
- nenhum diagnóstico, prescrição, cálculo calórico ou inferência de quantidade.

## Estrutura complementar proposta

Migration local `20261108180000_complete_nutrition_evaluation.sql`:

- `nutrition_evaluations`: campos estruturados da avaliação, vínculo composto com paciente/organização, autoria e profissional responsável;
- `dietary_recalls_24h`: refeições retrospectivas em JSON validado e vínculo composto obrigatório com a avaliação;
- duas RPCs transacionais com idempotência e conflito otimista;
- RLS profissional por vínculo ativo, auditoria sem conteúdo clínico, índices por paciente/data e nenhuma escrita direta do frontend.

A migration é não destrutiva, mantém as tabelas anteriores e não foi aplicada remotamente.

## Evidências executadas

- 61 testes Vitest aprovados;
- 86 testes pgTAP aprovados em PostgreSQL 17 oficial descartável;
- 6 cenários Playwright/Chromium aprovados em desktop e celular;
- build TypeScript/Vite aprovado;
- integração local por API aprovada com Auth, duas organizações, avaliação, recordatório, conflito, isolamento e MFA/TOTP;
- `npm audit --omit=dev --audit-level=high`: nenhuma vulnerabilidade.

## Pendências de homologação

- revisão e aplicação futura da migration no projeto exclusivo `zwnoxycxhlihqxhutlcy`;
- repetição dos testes RLS/Auth em homologação remota com dados fictícios;
- backup/restauração, retenção e exclusão;
- revisão ampliada de acessibilidade e navegadores;
- definição futura do relatório profissional, sem assinatura ou documento automático nesta etapa.

`VITE_REAL_DATA_APPROVED` permanece desabilitado.
