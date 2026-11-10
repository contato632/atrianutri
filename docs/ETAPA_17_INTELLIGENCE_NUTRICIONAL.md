# AtriaNutri — Etapa 17: Intelligence Nutricional

## Resultado

Foi implementado o primeiro núcleo funcional do AtriaNutri Intelligence na rota profissional `/intelligence`.

O módulo reúne dados existentes do acompanhamento, calcula indicadores verificáveis, cria uma linha do tempo e produz insights descritivos com regras explícitas. Não utiliza IA generativa, serviços externos, diagnóstico, previsão ou recomendação automática.

## Arquitetura

O motor está isolado de React em `src/domain/nutritionIntelligence.ts` e possui cinco etapas:

1. **Seleção de escopo** — paciente e intervalo de datas.
2. **Normalização** — avaliações, antropometria, diário, metas, acompanhamentos, versões e publicações são convertidos em eventos rastreáveis.
3. **Cálculo** — variações, intervalos, frequências e completude são calculados diretamente dos registros.
4. **Insights** — regras determinísticas geram mensagens, fontes, intervalo e limitações.
5. **Revisão** — a interface permite marcar, descartar, consultar a origem e preparar um resumo editável.

O mesmo workspace, paciente e período produzem sempre os mesmos resultados. O motor não modifica registros de origem nem snapshots históricos.

## Fontes utilizadas

- `nutrition_assessments`: medidas coletadas profissionalmente.
- `nutrition_evaluations`: existência, data e motivo registrado; observações profissionais privadas não entram na linha do tempo.
- `food_diary_entries`: origem, tipo de refeição, quantidade de itens e mudanças/dificuldades relatadas.
- `habit_goals`: criação, atualização e estado registrado.
- `habit_check_ins`: autoria, datas, texto descritivo e dificuldades.
- `meal_plan_versions`: snapshots imutáveis e resumos de alteração.
- `meal_plan_publications`: compartilhamento ou suspensão de uma versão.

Não são consultados dados financeiros, administrativos internos, notas clínicas privadas ou registros de outro paciente.

## Linha do tempo

Os eventos são ordenados de forma decrescente por data e possuem:

- identificador estável;
- data;
- tipo;
- origem profissional ou relato do paciente;
- resumo objetivo;
- identificadores das fontes;
- link para o módulo original.

Filtros permitem selecionar o tipo e períodos de 30 dias, 90 dias, 6 meses, 12 meses ou intervalo personalizado. Períodos sem registro permanecem vazios.

## Indicadores antropométricos

Para cada medida disponível, o motor apresenta:

- série temporal;
- unidade;
- quantidade de registros;
- variação absoluta;
- variação percentual entre primeiro e último registro;
- intervalo em dias.

Pontos ausentes não são interpolados. Uma única medida é exibida sem variação. Os gráficos usam escala iniciada em zero e identificam explicitamente fonte, unidade e quantidade de registros.

O percentual corporal é exibido apenas quando já registrado; o sistema não infere composição corporal.

## Diário, hábitos e metas

O diário distingue:

- consumo relatado pelo paciente;
- registro profissional;
- refeições da versão publicada do plano;
- quantidades ausentes ou não informadas.

A comparação entre plano e diário limita-se à presença de tipos de refeição comparáveis. O sistema não presume consumo e não calcula nutrientes sem composição validada.

Os hábitos apresentam número de metas, acompanhamentos, relatos do paciente, dificuldades textuais e maior intervalo entre registros. Ausência de registro nunca é convertida em descumprimento ou baixa adesão.

## Regras dos insights

Cada insight contém regra, período, fontes e limitações.

| Regra | Saída permitida | Limitação explícita |
|---|---|---|
| Contagem de avaliações no intervalo | Quantidade registrada | Não define frequência ideal ou resultado clínico |
| Comparação das duas últimas cinturas | Inferior, superior ou igual | Não determina causa, melhora ou piora |
| Acompanhamentos com dificuldades | Quantidade de campos textuais preenchidos | Exige leitura profissional; não mede adesão |
| Maior intervalo entre check-ins | Número de dias | Ausência de registro não significa descumprimento |
| Menos de três relatos alimentares | Dados insuficientes | Nenhum período é preenchido por inferência |
| Contagem de relatos alimentares | Registros compartilhados | Quantidade não mede adesão ou consumo do plano |
| Publicação posterior à avaliação | Sequência temporal | Sequência não representa causalidade |

Não existem regras para diagnóstico, risco, prognóstico, metabolismo, prescrição, “bom paciente”, “alimentação ruim”, sucesso ou fracasso.

## Revisão profissional

O nutricionista pode:

- abrir os registros de origem;
- marcar um insight para revisão;
- descartar e restaurar insights na sessão;
- escrever uma observação profissional privada;
- preparar um resumo determinístico;
- editar integralmente o resumo;
- restaurar o texto calculado;
- copiar apenas o texto revisado.

Esses estados são mantidos apenas na memória da sessão demonstrativa. Nenhuma observação é enviada ao paciente, salva em armazenamento inseguro ou incluída automaticamente em documentos.

## Resumo de acompanhamento

`prepareFollowUpSummary` organiza:

- paciente e período;
- quantidade de avaliações;
- variação aritmética de peso, quando calculável;
- metas, acompanhamentos e dificuldades;
- autoria dos registros do diário;
- incompletude de quantidades;
- eventos de publicação;
- limitações e necessidade de revisão.

O texto é um rascunho editável. Ele não contém recomendações ou conclusões clínicas.

## Integração com documentos

O resumo revisado pode ser copiado localmente para uso profissional posterior. Não há inclusão automática no PDF.

Esta decisão preserva:

- revisão humana antes do uso;
- exclusão de notas privadas;
- identidade profissional e CRN já configurados na Central de Documentos;
- geração local;
- correspondência atual entre prévia e download.

Uma integração direta futura deverá armazenar somente conteúdo explicitamente aprovado e manter os insights brutos fora dos documentos destinados ao paciente.

## Permissões e privacidade

- A rota é liberada apenas no modo demonstração ou para membro com acesso clínico que não seja recepção.
- O repositório Supabase continua responsável pelo recorte de organização e RLS profissional/paciente.
- O motor exige um paciente presente no workspace autorizado e filtra todos os registros pelo mesmo `patientId`.
- Revogar atribuição ou vínculo remove os dados do workspace real; o motor não mantém cópia persistente.
- Financeiro e notas privadas não integram as entradas do motor.
- Nenhum dado é enviado para APIs externas.
- Não foi utilizado `localStorage`, `sessionStorage` ou IndexedDB.

Não foi necessária nova migration: o módulo opera sobre snapshots e contratos já existentes. Persistir observações ou decisões de revisão exigirá migration e RLS próprios em etapa futura.

## Interface e acessibilidade

- Navegação profissional dedicada.
- Poucos blocos principais: tendências, insights, linha do tempo e revisão.
- Gráficos SVG com nome acessível e valores por ponto.
- Filtros rotulados e operáveis por teclado.
- Estados de carregamento, erro, ausência de pacientes e ausência de dados.
- Layout mobile validado em 390 × 844 sem rolagem horizontal.
- Linguagem neutra e não moralizante.

## Testes executados

- Vitest completo: **140 testes aprovados em 21 arquivos**.
- Playwright completo: **31 fluxos aprovados**, incluindo quatro específicos do Intelligence.
- Build TypeScript/Vite: aprovado.
- `git diff --check`: aprovado.

Os testes específicos cobrem ordenação, rastreabilidade, isolamento do paciente, ausência de financeiro e notas privadas, cálculos absolutos e percentuais, valores ausentes, separação prescrito/relatado, regras dos insights, determinismo do resumo, revisão, descarte, filtros e responsividade.

## Limitações e pendências

- Revisões, descartes e observações do Intelligence ainda são estados de sessão demonstrativa.
- Não há IA generativa ou processamento de texto livre além das regras explícitas.
- A comparação entre plano e diário não conclui consumo, adesão ou adequação.
- O módulo não calcula nutrientes de alimentos sem catálogo científico homologado.
- Persistência real continua bloqueada pelo gate existente.
- Antes de dados reais, permanecem necessárias a homologação das migrations anteriores, pgTAP, Auth, vínculos, backup e restauração.
