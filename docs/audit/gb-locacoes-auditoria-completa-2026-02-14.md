# Auditoria Técnica e de Negócio Completa - GB Locações SaaS

**Data da auditoria:** 14/02/2026  
**Escopo auditado:** Admin (`/admin/dashboard`, `/admin/orcamentos`,
`/admin/financeiro`, `/admin/rentals`, `/admin/equipamentos`, `/admin/whatsapp`,
`/admin/email`) e cliente (`/equipamentos`, `/equipamentos/[id]`, `/orcamento`,
`/area-cliente`)  
**Método:** auditoria técnica por leitura de código (frontend, APIs, modelos
Prisma e regras de negócio), com cruzamento contra `RESUMO_REUNIAO_DEV.md` de
11/02/2026.

> Nota de evidência: este relatório registra evidências de implementação no
> código-fonte (arquivo/linha). Não inclui screenshot de produção porque não
> houve sessão browser autenticada no ambiente de produção durante esta
> execução.

---

## 1. SUMÁRIO EXECUTIVO

- **Score geral:** **61/100**
- **Top 5 findings críticos:**

1. 🔴 **Exposição de dados em `/api/quotes` por `userId` em query string**
   (risco de acesso indevido a orçamentos de terceiros).  
   Evidência: `app/api/quotes/route.ts:202`, `app/api/quotes/route.ts:205`.
2. 🔴 **Quebra da regra de período por item na conversão Quote -> Rental**
   (rental usa datas globais do quote).  
   Evidência: `prisma/schema.prisma:377`, `prisma/schema.prisma:398`,
   `lib/rental-converter.ts:100`.
3. 🔴 **Fluxo AT_END inconsistente para ativação de locação** (PATCH exige
   pagamento; checkout ativa sem validação equivalente de pagamento).  
   Evidência: `app/admin/rentals/page.tsx:1095`,
   `app/api/admin/rentals/[id]/route.ts:149`,
   `app/api/admin/rentals/[id]/checkout/route.ts:79`.
4. 🔴 **Cálculo de multa de atraso inconsistente (10% vs 5% vs 2%)**.  
   Evidência: `app/api/admin/rentals/[id]/checkin/route.ts:77`,
   `app/api/admin/rentals/[id]/calculate-late-fee/route.ts:59`,
   `lib/late-fee-calculator.ts:35`.
5. 🔴 **Controles de segurança incompletos em escala (rate limit parcial, CSRF
   não evidenciado nas rotas core)**.  
   Evidência: `lib/rate-limit.ts:141`, apenas `7` de `131` arquivos de API com
   `checkRateLimit` (levantamento por busca no repositório).

- **Recomendação - pronto para escalar?** **Não (ainda).**  
  O sistema está funcional para operação diária, mas há riscos críticos de
  segurança e consistência de regras de negócio (principalmente autorização e
  fluxo quote->rental) que precisam ser corrigidos antes de escalar volume e
  tráfego.

---

## 2. MATRIZ DE CONFORMIDADE

## 2.1 Módulo 1 - `/admin/orcamentos`

| Verificação                                                | Status     | Severidade | Evidência                                                                                                         | Recomendação                                                      |
| ---------------------------------------------------------- | ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Lista de orçamentos carrega                                | ✅ OK      | Média      | `app/admin/orcamentos/page.tsx` carrega via `/api/admin/quotes`                                                   | Manter                                                            |
| Lista completa/paginação backend                           | ⚠️ Parcial | Alta       | UI chama sem paginação (`app/admin/orcamentos/page.tsx:447`); API limita 10 (`app/api/admin/quotes/route.ts:213`) | Passar `page/limit` na UI e adicionar paginação server-driven     |
| Exibição de `quoteCode` padrão `Q-YYYY-SEQUENCIAL`         | ✅ OK      | Baixa      | `lib/quote-code.ts:7`                                                                                             | Manter                                                            |
| Busca por `quoteCode` e nome do cliente                    | ✅ OK      | Média      | `app/api/admin/quotes/route.ts:247`, `app/api/admin/quotes/route.ts:249`                                          | Manter                                                            |
| Busca não usa ID de equipamento                            | ✅ OK      | Média      | Filtro usa `quote.id`, `quoteCode`, `name`, `email`, `phone` (`app/api/admin/quotes/route.ts:246-251`)            | Manter                                                            |
| Debounce na busca                                          | ❌ Ausente | Média      | Sem `debounce`/`setTimeout` na busca de orçamentos (`app/admin/orcamentos/page.tsx`)                              | Aplicar debounce 300-350ms                                        |
| Visualizações tabela/kanban/calendário                     | ⚠️ Parcial | Média      | Modo existe (`app/admin/orcamentos/page.tsx:279`), mas robustez funcional do calendário depende de validação E2E  | Cobrir com teste E2E dos 3 modos                                  |
| Página de detalhe dedicada `/admin/orcamentos/[id]`        | ❌ Ausente | Média      | Pasta contém só `page.tsx` e `loading.tsx` (`app/admin/orcamentos`)                                               | Criar rota detalhada ou documentar oficialmente padrão modal-only |
| Itens com datas individuais e preço detalhado              | ✅ OK      | Alta       | Exibição por item no modal (`app/admin/orcamentos/page.tsx` seção de itens)                                       | Manter                                                            |
| Campo global de período (não desejado na regra de negócio) | ⚠️ Parcial | Média      | Card "Período da Locação" (`app/admin/orcamentos/page.tsx:2017`)                                                  | Tratar como resumo derivado, não input/global source of truth     |
| Aprovar/Rejeitar/Reajuste                                  | ✅ OK      | Alta       | PATCH + ajustes (`app/api/admin/quotes/[id]/route.ts`, `app/api/admin/quotes/[id]/adjustments/route.ts`)          | Manter                                                            |
| Reajuste com categorias e justificativa                    | ✅ OK      | Média      | Endpoint de ajustes e categoria (`app/api/admin/quotes/[id]/adjustments/route.ts`)                                | Manter                                                            |
| Reajuste envia notificação (email/WhatsApp)                | ✅ OK      | Média      | Notificação no fluxo de ajuste (`app/api/admin/quotes/[id]/adjustments/route.ts`)                                 | Manter com monitoramento de falha                                 |
| Reajuste gera ofício/documento para download               | ❌ Ausente | Média      | Não há endpoint/ação explícita de ofício de reajuste no fluxo                                                     | Criar geração de PDF/ofício por ajuste                            |
| Boleto: proteção de cliques múltiplos/idempotência         | ✅ OK      | Alta       | Lock no frontend (`app/admin/orcamentos/page.tsx:997`) + advisory lock backend (`lib/quote-boleto.ts:124`)        | Manter e cobrir com teste de concorrência                         |

## 2.2 Módulo 2 - Conexão `/admin/orcamentos` ↔ `/admin/financeiro`

| Verificação                                   | Status     | Severidade | Evidência                                                                                                 | Recomendação                                    |
| --------------------------------------------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Pagamento aprovado gera reflexo no financeiro | ✅ OK      | Alta       | Webhook + conversão (`app/api/payments/boleto/webhook/route.ts`, `lib/quote-payment-conversion.ts`)       | Manter                                          |
| `quoteCode` visível no financeiro             | ✅ OK      | Média      | `app/api/admin/financial/entries/route.ts:185`                                                            | Manter                                          |
| Busca por `quoteCode`/nome no financeiro      | ✅ OK      | Média      | `lib/financial-scope.ts:42`, `lib/financial-scope.ts:52`                                                  | Manter                                          |
| Alterar vencimento sincroniza com gateway     | ✅ OK      | Alta       | Endpoint due-date (`app/api/admin/financial/entries/[id]/due-date/route.ts`)                              | Manter                                          |
| Valor bruto vs líquido                        | ⚠️ Parcial | Média      | Campos existem em `Payment`, mas validação de consistência fiscal ainda depende de rotina/entrada correta | Criar validações automáticas de reconciliação   |
| Imposto por CPF/CNPJ/CNI                      | ⚠️ Parcial | Média      | Configuração presente (`admin-financeiro-page`), mas precisa cobertura forte de cálculo                   | Adicionar testes fiscais com cenários PF/PJ/CNI |
| PDF formato ofício                            | ✅ OK      | Média      | Export em PDF de ofício (`app/api/admin/financial/export/route.ts:751`)                                   | Manter                                          |
| Filtros por status financeiro                 | ✅ OK      | Média      | `parseFinancialStatusFilter` + UI de filtros                                                              | Manter                                          |
| Visualização calendário de vencimentos        | ✅ OK      | Média      | Endpoint calendário (`app/api/admin/financial/calendar/route.ts`) + view na UI                            | Manter                                          |
| Debounce de 350ms na busca                    | ✅ OK      | Baixa      | `app/admin/financeiro/page.tsx:202`                                                                       | Manter                                          |

## 2.3 Módulo 3 - Conexão `/admin/orcamentos` ↔ `/admin/rentals`

| Verificação                                      | Status     | Severidade | Evidência                                                                                                                                  | Recomendação                                                     |
| ------------------------------------------------ | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Orçamento aprovado pode virar locação            | ✅ OK      | Alta       | Conversão existe (`app/api/admin/quotes/[id]/convert-to-rental/route.ts`)                                                                  | Manter                                                           |
| Conversão cria rental com itens                  | ✅ OK      | Alta       | `lib/rental-converter.ts:105`                                                                                                              | Manter                                                           |
| Rental herda datas individuais por item          | 🔴 Bug     | Crítica    | Converter usa datas globais (`lib/rental-converter.ts:100`); `rental_items` sem datas no schema (`prisma/schema.prisma:398`)               | Incluir `startDate/endDate` em `rental_items` e migrar conversão |
| Equipamento fica indisponível automaticamente    | ⚠️ Parcial | Alta       | Regras de disponibilidade divergentes entre APIs                                                                                           | Unificar regra única de disponibilidade                          |
| Contagem de estoque atualiza corretamente        | ⚠️ Parcial | Alta       | Catálogo usa `equipment.available` (`app/api/equipments/route.ts:291`) sem integração completa por unidade                                 | Migrar para disponibilidade calculada por unidade/período        |
| Status de locação (Pendente/Ativo/Concluído/...) | ✅ OK      | Média      | Enum e fluxo existentes (`app/api/admin/rentals/[id]/route.ts`)                                                                            | Manter                                                           |
| Extensão de locação                              | ✅ OK      | Média      | Endpoint `extend` presente (`app/api/admin/rentals/[id]/extend/route.ts`)                                                                  | Manter com teste de conflito                                     |
| Devolução libera equipamento                     | ⚠️ Parcial | Alta       | Check-in existe, mas sincronização de disponibilidade precisa unificação                                                                   | Acoplar check-in ao serviço central de disponibilidade           |
| Marcação de atraso                               | ✅ OK      | Média      | Status `OVERDUE` previsto                                                                                                                  | Manter                                                           |
| Kanban/calendário de locações                    | ⚠️ Parcial | Média      | UI existe; faltam testes E2E cobrindo bordas                                                                                               | Cobrir em Playwright                                             |
| Multa por atraso calculada consistentemente      | 🔴 Bug     | Crítica    | 10% (`checkin`), 5% (`calculate-late-fee`), 2% (`lib`)                                                                                     | Centralizar em uma única função/configuração                     |
| Regra AT_END sem pagamento inicial               | ⚠️ Parcial | Alta       | PATCH para `ACTIVE` exige pagamento (`app/api/admin/rentals/[id]/route.ts:149`), checkout possui regra diferente (`.../checkout/route.ts`) | Unificar ativação operacional por termo de pagamento             |

## 2.4 Módulo 4 - Conexão `/admin/orcamentos` ↔ `/admin/dashboard`

| Verificação                                      | Status     | Severidade | Evidência                                                                                           | Recomendação                              |
| ------------------------------------------------ | ---------- | ---------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| KPIs de orçamentos (pendente/aprovado/rejeitado) | ✅ OK      | Média      | `app/api/admin/dashboard/route.ts:265-267`                                                          | Manter                                    |
| Receita total e mensal                           | ✅ OK      | Média      | `app/api/admin/dashboard/route.ts:309`                                                              | Manter                                    |
| Taxa de conversão orçamentos -> locações         | ⚠️ Parcial | Média      | UI tem campo `conversionRate` (`app/admin/dashboard/page.tsx:175`), API não expõe cálculo explícito | Calcular no backend e padronizar payload  |
| Equipamentos mais locados                        | ⚠️ Parcial | Média      | Há métricas de ROI/utilização, mas não ranking claro "mais locados" na saída simplificada           | Adicionar endpoint/campo dedicado         |
| Clientes recorrentes                             | ❌ Ausente | Média      | Não há métrica explícita na resposta do dashboard                                                   | Incluir KPI de recorrência                |
| Status de pagamentos                             | ⚠️ Parcial | Média      | Métricas financeiras existem, mas sem visão consolidada operacional por status no payload principal | Incluir bloco de cobrança no dashboard    |
| Alertas (boletos vencidos/atrasos/manutenção)    | ⚠️ Parcial | Alta       | Parte dos dados existe, mas sem orquestração única de alertas                                       | Criar painel de alertas acionáveis        |
| Atualização em tempo real/refresh                | ⚠️ Parcial | Baixa      | Fetch inicial e refresh manual; sem streaming/polling formal                                        | Adicionar refresh periódico opcional      |
| Filtro por período (hoje/semana/mês/ano/custom)  | ❌ Ausente | Média      | Fetch sem query de período (`app/admin/dashboard/page.tsx:440`) e API sem `searchParams` de período | Implementar filtro temporal ponta a ponta |
| Responsividade desktop/tablet                    | ✅ OK      | Baixa      | Estrutura responsiva no frontend                                                                    | Manter                                    |

## 2.5 Módulo 5 - Fluxo Completo do Cliente

| Verificação                                        | Status     | Severidade | Evidência                                                                                  | Recomendação                                             |
| -------------------------------------------------- | ---------- | ---------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Catálogo público sem login                         | ✅ OK      | Baixa      | `app/equipamentos/page.tsx` público                                                        | Manter                                                   |
| Busca/filtros no catálogo                          | ✅ OK      | Baixa      | `app/equipamentos/page.tsx`                                                                | Manter                                                   |
| Detalhe de equipamento com configuração de período | ✅ OK      | Média      | `app/equipamentos/[id]/page.tsx`                                                           | Manter                                                   |
| Opção apenas dias úteis                            | ✅ OK      | Média      | Fluxo com `includeWeekends` e cálculo por item                                             | Manter                                                   |
| Cálculo de preço em tempo real                     | ✅ OK      | Média      | `lib/quote-pricing.ts` + UI                                                                | Manter                                                   |
| Carrinho mantém configurações por item             | ✅ OK      | Alta       | `startDate/endDate/days/includeWeekends` persistidos                                       | Manter                                                   |
| `/orcamento` exibe itens com datas individuais     | ✅ OK      | Alta       | `app/orcamento/page.tsx`                                                                   | Manter                                                   |
| Formulário coleta dados completos do cliente       | ✅ OK      | Média      | `app/orcamento/page.tsx` e schema POST                                                     | Manter                                                   |
| Submissão gera `quoteCode`                         | ✅ OK      | Alta       | `app/api/quotes/route.ts:628` + `lib/quote-code.ts`                                        | Manter                                                   |
| Confirmação por email                              | ✅ OK      | Média      | envio no POST de quotes                                                                    | Manter                                                   |
| Área do cliente mostra orçamentos/status           | ✅ OK      | Média      | `app/area-cliente/page.tsx`                                                                | Manter                                                   |
| Histórico de locações/pagamentos                   | ⚠️ Parcial | Média      | Dados existem, porém dependem de endpoint vulnerável a `userId` query (finding crítico)    | Corrigir autorização em `/api/quotes` e revisar payloads |
| Documentos anti-fraude (foto/selfie/contrato)      | ⚠️ Parcial | Alta       | Upload/validação existe no fluxo de rentals admin, mas self-service cliente ainda limitado | Consolidar módulo de documentos no portal do cliente     |

## 2.6 Módulo 6 - Segurança e Permissões

| Verificação                                    | Status                        | Severidade | Evidência                                                                                                                                | Recomendação                                                    |
| ---------------------------------------------- | ----------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| ADMIN com acesso total                         | ✅ OK                         | Baixa      | Guardas e layout admin                                                                                                                   | Manter                                                          |
| FINANCIAL restrito ao financeiro               | ⚠️ Parcial                    | Alta       | Redirecionamento no layout (`app/admin/admin-layout-client.tsx:58`) porém endpoints de boleto aceitam FINANCIAL (`generate/send-boleto`) | Restringir FINANCIAL estritamente ao escopo financeiro acordado |
| CLIENT sem acesso a `/admin/*`                 | ✅ OK                         | Média      | Guardas de rota e sessão                                                                                                                 | Manter                                                          |
| Guards de API (`requireAdmin`, etc.)           | ⚠️ Parcial                    | Alta       | Presentes em várias rotas, cobertura desigual                                                                                            | Auditoria de 100% dos endpoints admin                           |
| Rate limiting em rotas públicas/admin/auth/api | ❌ Ausente (global)           | Alta       | `checkRateLimit` em 7/131 rotas                                                                                                          | Aplicar política uniforme por classe de rota                    |
| Audit logging financeiro                       | ⚠️ Parcial                    | Média      | Infra existe (`lib/audit-log.ts`), uso não homogêneo nas rotas core                                                                      | Instrumentar ações críticas com trilha obrigatória              |
| Sanitização HTML                               | ✅ OK                         | Média      | `lib/sanitize.ts`, uso em módulos com HTML                                                                                               | Expandir para todos os campos ricos                             |
| Proteção CSRF em formulários/API               | ❌ Ausente (evidência direta) | Alta       | Sem validação CSRF clara nas rotas auditadas                                                                                             | Implementar proteção CSRF/token por sessão                      |
| Isolamento de dados por usuário no cliente     | 🔴 Bug                        | Crítica    | `userId` query em `/api/quotes` sem validação de ownership                                                                               | Obrigar `session.user.id` no backend e ignorar query externa    |

## 2.7 Módulo 7 - Competitividade SaaS

| Verificação                                                      | Status     | Severidade | Evidência                                                                 | Recomendação                                   |
| ---------------------------------------------------------------- | ---------- | ---------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| Catálogo público profissional                                    | ✅ OK      | Baixa      | Implementado                                                              | Manter                                         |
| Orçamento online self-service                                    | ✅ OK      | Alta       | Implementado                                                              | Manter                                         |
| Preço inteligente por período                                    | ✅ OK      | Alta       | `lib/quote-pricing.ts`                                                    | Manter                                         |
| Pagamentos múltiplos (boleto/PIX/cartão)                         | ⚠️ Parcial | Média      | Boleto operacional; suporte PIX/cartão não consolidado no fluxo principal | Consolidar UX de meios de pagamento            |
| Portal do cliente                                                | ✅ OK      | Média      | Implementado                                                              | Evoluir com documentos e autosserviço          |
| Notificações automáticas                                         | ✅ OK      | Média      | Email e integrações presentes                                             | Robustecer monitoramento                       |
| Painel admin operacional                                         | ✅ OK      | Média      | Implementado                                                              | Melhorar consistência entre módulos            |
| Relatórios financeiros exportáveis                               | ✅ OK      | Média      | PDF de ofício disponível                                                  | Manter                                         |
| Estoque em tempo real                                            | ⚠️ Parcial | Alta       | Regras de disponibilidade divergentes                                     | Criar serviço único de estoque/disponibilidade |
| Responsividade mobile                                            | ⚠️ Parcial | Média      | Boa cobertura geral; faltam validações E2E completas                      | Bateria de testes mobile crítica               |
| Diferenciais (WhatsApp, permissões granulares, docs anti-fraude) | ⚠️ Parcial | Média      | Parcialmente implementados                                                | Fechar fluxos ponta a ponta                    |

---

## 3. ANÁLISE DE FLUXO DE TRABALHO

### Fluxo atual (implementação observada)

```text
Cliente cria orçamento -> Quote PENDING + boleto
  -> Admin aprova/rejeita (com exceções por paymentTerms)
  -> Webhook pagamento atualiza status
  -> Conversão para rental (datas globais no rental)
  -> Operação de checkout/checkin com regras parcialmente divergentes
```

### Fluxo ideal (negócio + operação)

```text
Cliente cria orçamento (itens com período independente)
  -> Admin revisa + reajuste (se necessário) + notificação omnicanal
  -> Regra clara por paymentTerms:
       UPFRONT/ON_DELIVERY: pagamento confirmado -> ativação
       AT_END: ativação operacional sem bloqueio por pagamento inicial
  -> Conversão em rental preservando datas por item
  -> Disponibilidade/estoque centralizados por unidade e período
  -> Check-out/check-in + multa + documentos anti-fraude + audit log
  -> Dashboard/financeiro sincronizados em tempo quase real
```

### Pontos de atrito

1. Paginação/listagem de orçamentos e locações pode ocultar dados operacionais.
2. Fluxo AT_END confunde operação por validações conflitantes.
3. Inconsistência de disponibilidade/estoque entre módulos e APIs.
4. Falta de detalhe dedicado `/admin/orcamentos/[id]` dificulta rastreabilidade
   operacional.
5. Métricas de dashboard ainda sem padronização de período e conversão.

### Automações faltantes

1. Motor único para transição de status e validação de regras
   (quote/rental/payment).
2. Regra centralizada de multa de atraso.
3. Alertas operacionais unificados (vencimento, atraso, manutenção).
4. Guardas de segurança e rate limiting aplicados de forma uniforme.

### Handoffs manuais que deveriam ser automáticos

1. Reconciliação financeira de bruto/líquido/impostos por documento.
2. Consolidação de disponibilidade por equipamento/unidade no catálogo e no
   admin.
3. Geração de documento formal de reajuste (ofício) no próprio fluxo.

---

## 4. GAPS DE NEGÓCIO (PRIORIZADO)

| Gap                                                    | Impacto (1-5) | Esforço | Prioridade | Observação                       |
| ------------------------------------------------------ | ------------- | ------- | ---------- | -------------------------------- |
| Isolamento de dados por usuário em `/api/quotes`       | 5             | P       | P0         | Risco direto de vazamento        |
| Preservar período por item em `rental_items`           | 5             | M       | P0         | Regra central de negócio         |
| Unificar fluxo AT_END e ativação de rental             | 5             | M       | P0         | Evita bloqueio operacional       |
| Unificar cálculo de multa de atraso                    | 4             | P       | P0         | Evita cobrança incorreta         |
| Aplicar rate limit padrão em APIs críticas             | 4             | M       | P1         | Segurança e estabilidade         |
| Implementar CSRF nas rotas/formulários state-changing  | 4             | M       | P1         | Redução de risco de abuso        |
| Dashboard com filtro temporal real + conversão oficial | 3             | M       | P1         | Gestão executiva                 |
| Documento/ofício de reajuste com download              | 3             | M       | P1         | Alinhado à reunião 11/02         |
| Serviço único de disponibilidade/estoque por período   | 4             | G       | P1         | Evita overbooking e divergências |
| Bloqueio de inadimplente para novo aluguel             | 4             | M       | P2         | Gap competitivo relevante        |
| Gestão de avarias com evidência fotográfica            | 3             | M       | P2         | Redução de perdas                |
| Utilização por ativo (% tempo locado)                  | 3             | M       | P2         | KPI estratégico                  |

---

## 5. RISCOS OPERACIONAIS

| Risco                                               | Tipo                | Probabilidade | Impacto | Evidência                                       | Mitigação                                    |
| --------------------------------------------------- | ------------------- | ------------- | ------- | ----------------------------------------------- | -------------------------------------------- |
| Acesso indevido a dados de orçamento                | Segurança/Fraude    | Alta          | Crítico | `app/api/quotes/route.ts` usa `userId` da query | Forçar ownership por sessão                  |
| Cobrança inconsistente de multa                     | Financeiro/Jurídico | Alta          | Alto    | 3 fórmulas diferentes (10/5/2%)                 | Centralizar regra e versionar política       |
| Operação travada por regra de pagamento conflitante | Operacional         | Média         | Alto    | PATCH vs checkout em rentals                    | Motor único de ativação                      |
| Divergência de estoque/disponibilidade              | Operacional/UX      | Média         | Alto    | Regras distintas em APIs                        | Serviço central de disponibilidade           |
| Sobrecarga e abuso por falta de rate limit global   | Segurança/Infra     | Média         | Alto    | 7/131 APIs com rate limit                       | Política por rota (strict/admin/auth/public) |
| Erro humano por escopo de permissões ambíguo        | Governança          | Média         | Médio   | FINANCIAL com ações além do escopo estrito      | Revisar matriz de permissões por endpoint    |

---

## 6. ROADMAP DE CORREÇÕES

## Sprint 1 (1 semana) - Bugs críticos e quick wins

1. Corrigir autorização de `/api/quotes` para usar somente `session.user.id`.
2. Unificar cálculo de multa de atraso em uma função única.
3. Alinhar fluxo AT_END entre PATCH/checkout para ativação operacional
   consistente.
4. Garantir paginação real em `/admin/orcamentos` e `/admin/rentals` (UI + API).
5. Aplicar rate limit nas rotas públicas e de mutação mais sensíveis.

## Sprint 2 (2 semanas) - Core funcional faltante

1. Migrar modelo `rental_items` para suportar `startDate/endDate` por item.
2. Refatorar conversão quote->rental preservando período de cada item.
3. Criar documento/ofício de reajuste com download no fluxo admin.
4. Fechar matriz de permissões FINANCIAL por endpoint (escopo estrito).
5. Adicionar proteção CSRF em mutações de formulários/API.

## Sprint 3 (1 mês) - Competitividade e escala

1. Serviço central único de disponibilidade/estoque por unidade e período.
2. Dashboard com filtros temporais completos + KPI de conversão e recorrência.
3. Bloqueio automatizado de novo aluguel para inadimplentes.
4. Relatórios avançados (utilização por ativo, atraso, recorrência).
5. Fortalecer portal do cliente com documentos anti-fraude ponta a ponta.

---

## 7. SCORE POR MÓDULO

| Módulo       | Score      | Justificativa                                                                               |
| ------------ | ---------- | ------------------------------------------------------------------------------------------- |
| Orçamentos   | **66/100** | Fluxo rico e funcional, mas com lacunas de paginação, debounce e detalhe dedicado           |
| Financeiro   | **74/100** | Módulo maduro (busca, filtros, calendário, exportação), faltando hardening fiscal/segurança |
| Locações     | **53/100** | Conversão existe, porém regras críticas de período e ativação ainda inconsistentes          |
| Dashboard    | **58/100** | KPIs base existem; falta período real, conversão oficial e alertas unificados               |
| Catálogo     | **70/100** | Boa experiência e fluxo de orçamento, mas disponibilidade ainda não totalmente unificada    |
| Área Cliente | **63/100** | Portal útil com histórico/status, porém depende de fix crítico de autorização em quotes     |
| Segurança    | **45/100** | Guardas presentes, porém gaps críticos em autorização, CSRF e rate limit global             |

---

## Cruzamento com Reunião de 11/02/2026

| Item da reunião                            | Situação atual                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Painel financeiro dedicado                 | **Implementado** (tabela, calendário, filtros, export PDF)                                          |
| Reajuste categorizado com envio            | **Implementado** (email/WhatsApp)                                                                   |
| Documento/ofício de reajuste para download | **Gap**                                                                                             |
| Permissões rígidas para FINANCIAL          | **Parcial** (layout restringe, endpoints específicos ainda aceitam além do escopo estrito)          |
| Correção de busca por código do orçamento  | **Implementado** (`quoteCode`, nome, etc.)                                                          |
| Anti-fraude documental no fluxo            | **Parcial** (boa cobertura no fluxo de rentals admin; evolução no portal cliente ainda recomendada) |
| Proteção contra boleto duplicado           | **Implementado** (lock frontend + idempotência backend)                                             |
