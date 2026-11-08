# AtriaNutri — Anamnese nutricional (continuidade funcional)

Nova entrega na PR #1 sem merge, deploy ou alteração no banco remoto.

## Novo fluxo
- Na página de cada paciente, o profissional abre **Anamnese nutricional** em um único clique.
- Editor compacto por grupos: objetivos e histórico alimentar; rotina e observações profissionais.
- Campos opcionais; validação de tamanhos conforme as restrições existentes na tabela `patient_clinical_profiles` (4 mil para objetivo e 12 mil para os demais).
- Se já existe anamnese, edição carrega os dados existentes, preserva alterações enquanto modal aberto e apresenta falhas sem fechar ou perder conteúdo.
- Demonstração: salva em memória, como todo o app demo.
- Supabase: grava na tabela clínica já existente, restrita por RLS. A primeira gravação usa INSERT com autoria do usuário autenticado; atualizações usam filtro por paciente, organização e `updated_at` para detectar edições concorrentes.
- Não adiciona tabelas, policies, migrations, permissões ou acessos.
- Mantido o bloqueio de dados reais no frontend por `VITE_REAL_DATA_APPROVED=false`.

## Pendências
- Novo fluxo **não foi executado em navegador ou teste remoto neste commit**, a pedido de continuar desenvolvendo sem homologação manual neste momento.
- A implementação inclui cenários unitários novos para salvamento demo e conflito otimista; executar suíte completa `npm run check` posteriormente.
- Testes de autorização da anamnese com usuários fictícios e backup/restauração continuam necessários antes da liberação clínica.
