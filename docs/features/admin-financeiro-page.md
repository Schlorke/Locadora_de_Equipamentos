# Painel Financeiro Admin (`/admin/financeiro`)

> **Status**: Critical  
> **Last updated**: 2026-02-14

---

## 1. Purpose

Centralizar cobranca e acompanhamento financeiro em uma pagina dedicada,
separada do dashboard geral, com foco no fluxo operacional da
secretaria/financeiro.

## 2. Scope

**In scope**

- Listagem financeira por boleto de locacao (`Payment` tipo `RENTAL` + metodo
  `BOLETO`)
- Cobertura de pagamentos convertidos (quando `quoteId` fica `null` e o vínculo
  passa a ser via `rentalId`)
- Busca unificada por cliente, `quoteCode` e codigo legado
- Filtro por status financeiro operacional (`PAID`, `UNPAID`,
  `AWAITING_PAYMENT`, `SETTLED`)
- Visao em tabela e calendario
- Configuracao de aliquotas (CPF/CNPJ/CNI)
- Alteracao de vencimento de boleto com sincronizacao no gateway (Asaas)
- Exportacao em PDF (formato oficio)
- Bloco de reajuste no detalhe do lancamento: aplicar reajuste, historico e
  excluir reajuste (quando `quoteId` existe e status nao e pago/baixado)

**Out of scope**

- Conciliacao bancaria automatica
- Emissao de NF-e
- DRE/contabilidade gerencial completa

## 3. Entry Points

- Tela: `packages/frontend/src/pages/financeiro/ui/FinanceiroPage.web.tsx` e
  variante `FinanceiroPage.native.tsx`; o host web monta o export público
  `AdminFinanceiroPageWrapper` em
  `apps/clients/web/src/app/(admin)/admin/financeiro/page.tsx`.
- API HTTP: `apps/services/api/src/app/api/admin/financial`, com GET de
  entries/calendar/revenue/aging/export/settings; PATCH de settings e
  entries/[id]/status/due-date; DELETE de entries/[id]; ofício de
  [id]/pdf-oficio.
- Reajustes: `apps/services/api/src/app/api/admin/quotes/[id]/adjustments`
  (GET/POST e DELETE de [adjustmentId]); mantém a política QUOTES do próprio
  adapter, não a substitui pelo guarda financeiro.
- Guardas: `apps/services/api/src/host/permissions.ts` compõe
  `createTenantPermissionResolver` com o principal de
  `host/private-identity.ts`. Leituras financeiras exigem FINANCIAL/READ;
  mutações usam a ação explícita da rota. ADMIN do vínculo dispensa lookup de
  Permission, CLIENT é recusado e os demais papéis precisam da permissão
  correspondente nesta locadora.
- Composição das consultas em `host/financial-read.ts`, mutações e pedido de
  reemissão em `host/financial-mutations.ts`; regras e transações ficam em
  backend/billing. A navegação web continua passando pelo gate do bootstrap de
  `packages/frontend/src/app/providers/RuntimeBootstrap.tsx`.

O papel global da sessão não autoriza outra locadora. A resolução revalida
membership/seleção e cada caso recebe o principal/tenant corrente.

## 4. Core Flow

1. Usuario `ADMIN` ou `FINANCIAL` abre `/admin/financeiro`.
2. Se a rota vier com query (`?search=...` e/ou `?status=...`), os filtros
   iniciais sao preenchidos automaticamente.
3. Frontend carrega em paralelo: lancamentos, calendario e aliquotas.
4. Usuario filtra por status e/ou busca cliente/codigo.
5. Usuario:
   - atualiza status financeiro de um lancamento, ou
   - solicita reemissão para alterar vencimento; 202 indica pedido durável
     pendente, sem mudar a data confirmada antes do worker, ou
   - ajusta aliquotas CPF/CNPJ/CNI, ou
   - exporta o relatorio em PDF.
6. Na view Dashboard do Financeiro, os graficos de receita/aging usam os mesmos
   filtros ativos da tabela (search, status e periodo).
7. Quando houver referencia de orcamento, o usuario pode abrir diretamente
   `/admin/orcamentos` pelo atalho "Ver orçamento".

## 5. Components and Files

- `packages/frontend/src/pages/financeiro/ui/FinanceiroPage.web.tsx`,
  `FinanceiroPage.native.tsx` e componentes da própria slice.
- `pages/financeiro/model/carga.ts`, `carga.web.ts`, `detalhe.ts` e
  `detalhe.web.ts`: modelos comuns e portas web; `api/financial.ts` e
  `api/documents.ts`: transporte pelo HttpClient configurado.
- `packages/ui/src/web/StatusTooltip.web.tsx` e
  `packages/ui/src/status-definitions.ts`: apresentação compartilhada.
- `packages/backend/src/modules/billing/financial-scope.ts`: builder único de
  filtros, incluindo tenant e fallback de pagamentos convertidos.
- `packages/backend/src/modules/billing/financial-mutations.ts` e
  `boleto-reissue.ts`: snapshots, baixa e pedido de reemissão/outbox.
- `apps/services/api/src/host/financial-read.ts`, `financial-mutations.ts` e
  `permissions.ts`: composição do servidor.
- `apps/clients/web/src/app/(admin)/layout.tsx` e
  `packages/frontend/src/app/providers/AdminLayoutShell.web.tsx`: host fino e
  shell visual; menu em `packages/frontend/src/widgets/menu-admin`.

Ofício de lançamento: GET /api/admin/financial/entries/[id]/pdf-oficio usa
query, fallback, mapper, branding e renderer de backend/documents.
FINANCIAL/READ, tenant, preview e snapshots permanecem no servidor; autoria da
Organization e falha inesperada sem detail. O registro da instalação nos dois
hosts em 2026-10-02 está na onda 37 de [API compartilhada](shared-api-host.md).
A existência da composição atual não prova emissão externa ou operação Asaas.

## 6. Data and State

- `Payment`:
  - `billingStatus`, `grossAmount`, `netAmount`, `taxRate`, `taxDocumentType`,
    `boletoIssuedAt`, `invoiceIssuedAt`, `settledAt`
- `FinancialSetting`:
  - `cpfRate`, `cnpjRate`, `cniRate`, `updatedBy`
- Snapshot financeiro:
  - cada pagamento preserva os valores/aliquota usados no momento de geracao

## 7. Constraints and Edge Cases

- A navegação mantém a política do papel do vínculo (FINANCIAL fora desta área é
  redirecionado ao financeiro). APIs revalidam o principal e a Permission
  FINANCIAL/ação; não usar o papel da sessão como bypass de tenant.
- Busca deve considerar `quoteCode` e `legacyExternalCode`, nao apenas
  `quote.id`, com fallback de dados por `rental.quote` e `rental.users` para
  pagamentos convertidos.
- As rotas financeiras devem compartilhar o mesmo builder de escopo em
  `packages/backend/src/modules/billing/financial-scope.ts` para evitar
  divergencia de filtros/agregacoes.
- Alteracao de aliquota afeta novos calculos; historico existente mantem
  snapshot.
- `SETTLED` representa baixa operacional e nao necessariamente `PAID`.

## 8. Error Handling

- 401: usuario nao autenticado
- 403: role sem permissao financeira
- 400: status/parametros invalidos
- 500: erro interno ao consultar/atualizar/exportar

## 9. Performance and Accessibility

- Carregamento paralelo das fontes principais (`Promise.all`)
- Filtro server-side para evitar transferir lista inteira desnecessariamente
- **Busca com debounce (350ms)**: input mantém estado local e só propaga
  `searchTerm` após parada de digitação, evitando re-render da página inteira a
  cada tecla e múltiplas requisições; `loadEntries` roda uma vez quando o termo
  estabiliza.
- Atualização de lista com `startTransition` para não bloquear a UI durante o
  set de `entries`/`totals`.
- `DebtorsTable` memoizado (`React.memo`) para evitar re-renders quando
  `data`/`expanded` não mudam.
- Tabela com overflow horizontal em telas pequenas
- Tooltip de status com `aria-label`

## 10. Tests and Validation

1. Login com role `FINANCIAL` deve abrir `/admin/financeiro`.
2. Role `FINANCIAL` deve ser redirecionada ao tentar abrir outras rotas admin.
3. Busca por cliente e por `quoteCode` deve retornar os registros esperados.
4. Mudanca de `billingStatus` deve persistir no banco.
5. Exportacao PDF deve baixar arquivo valido com total bruto/liquido.
6. Mudanca de aliquotas deve refletir no endpoint de configuracao.
7. Pagamento convertido (sem `quoteId`, com `rentalId`) deve continuar visivel
   em tabela, calendario e exportacao.
8. Acao "Ver orçamento" deve abrir `/admin/orcamentos?search=<codigo>`
   preservando contexto da cobranca.
9. Pedido de vencimento deve retornar 202, persistir a operação e conservar
   `Payment.dueDate` confirmado até o worker provar cancelamento/substituição.
10. Só após confirmação do worker verificar a nova data/estado; não usar 202
    como prova de boleto pronto. DELETE de histórico responde 409
    FINANCIAL_HISTORY_PRESERVED e não apaga Payment.
11. Filtros identicos na tabela devem refletir os mesmos dados nos graficos da
    view Dashboard (receita/aging).

## 11. Related Docs

- `docs/features/admin-system.md`
- `docs/features/quote-system.md`
- `docs/features/quote-status-tracking.md`
- `docs/issues/known-issues.md`

## 12. Change Log

- 2026-02-21: Bloco de reajuste no detalhe do lancamento passou a ter botao para
  excluir cada item do historico; dialog de confirmacao; API DELETE de
  adjustments aceita role FINANCIAL.
- 2026-02-11: Criacao do painel financeiro dedicado com APIs, filtros,
  calendario e exportacao PDF.
- 2026-02-14: Inclusao de pagamentos convertidos (`rentalId`) em listagem,
  calendario e exportacao + navegacao direta para orcamentos e prefill por query
  (`search`/`status`).
- 2026-02-14: Acao de alterar vencimento no detalhe do lancamento com endpoint
  dedicado (`PATCH /entries/[id]/due-date`) e sincronizacao no gateway de
  boleto.
- 2026-02-14: Performance da busca: debounce no input
  (FinanceiroFilterCardWithDebouncedSearch), startTransition ao atualizar
  entries/totals, DebtorsTable com React.memo.
- 2026-02-14: Dashboard financeiro passou a aplicar os mesmos filtros
  (search/status/periodo) em `revenue` e `aging`; backend alinhado por escopo
  compartilhado (antiga fachada `lib/financial-scope.ts`, retirada em F, nesse
  checkpoint; hoje `packages/backend/src/modules/billing/financial-scope.ts`) e
  cron de boleto sincronizando `status` + `billingStatus`.

---

## Extração das consultas financeiras (2026-10-02)

Registro histórico da onda 38: GET de
aging/calendar/entries/export/revenue/settings foi disponibilizado nos dois
hosts. Filtros, transações, snapshots, agregações e perfil da locadora estão em
packages/backend/src/modules/billing; renderers de PDF/XLSX/CSV em
backend/documents. Clientes continuam na origem legada. PATCH de settings e
demais mutações ainda eram legados na onda 38. Não alterar a origem antes de
paridade operacional. Evidências e dívida anterior: onda 38 de
[API compartilhada](shared-api-host.md) e entrada 238 de known-issues.

Após a retirada da raiz, esses GETs pertencem aos adapters de
`apps/services/api/src/app/api/admin/financial` e à composição
`host/financial-read.ts`; o cliente configurado está na própria slice
`pages/financeiro`. A origem legada descrita acima é do checkpoint da onda 38.

## Extração das mutações financeiras (2026-10-02)

Registro histórico da onda 39: PATCH de settings/status/due-date e DELETE de
entries/[id] disponibilizados nos dois hosts sobre backend/billing. Schemas em
contracts/financial; settings append-only, baixa e pedido durável de vencimento
mantêm autorização, locadora, locks, outbox e rollback. Reemissão retorna 202 e
somente o worker confirma cancelamento/substituição e muda a data; não é
atualização síncrona. DELETE continua respondendo 409
FINANCIAL_HISTORY_PRESERVED, sem apagar dados. Esses contratos preservam pedido
pendente e confirmação do worker; os passos 9–10 acima já descrevem essa
distinção.

Emissão externa, workers/jobs e clientes continuam na composição/origem legada.
Evidências nos dois motores e riscos na onda 39 de
[API compartilhada](shared-api-host.md). Agregação/CSV (238) e texto da UI de
exclusão permanecem dívidas explícitas, fora desta extração.

O destino pós-retirada é `apps/services/api/src/host/financial-mutations.ts`
sobre `@gb-locacoes/backend/billing`. Operação externa e configuração de
scheduler/provedores exigem sua própria implantação; não são resultado desta
atualização documental.

## Consumidor de boleto/ofício (onda 66, 2026-10-03)

Segunda via/vencimento usam entidade pagamento; ofício usa api da página, pelo
HttpClient configurado. PUT sem corpo/PATCH com dueDate e 202 pendente
preservados. Página reinicia por locadora/papel/usuário, descartando sucesso e
releitura antigos. Ofício espera PDF em aba aberta no clique, fechando a aba
vazia em erro/cancelamento. Outros carregamentos/mutações continuam pendentes;
filtros/valores/UI intactos. Provas na onda 66 de
[API compartilhada](shared-api-host.md).

## Carga, ações e exportação no transporte configurado (onda 67, 2026-10-03)

Carga e detalhe usam api/financial da própria página. Lista 10000, calendário,
gráficos, filtros, taxas/reset e seleção mantêm contratos; PATCH/DELETE e
reajustes preservam payloads/flags e recusas do backend. Exportação consome
bytes e mantém nomes PDF/XLSX/CSV; popup bloqueado não libera arquivo.

Escopo descarta resultados/sucesso antigos após rede e callbacks, sem desfazer
efeito remoto aceito. Estilos/cálculos preservados. Contrato de download testado
com DOM simulado; navegador/aparelho/revogação da URL ainda requerem aceite. 82
casos do bloco e seis HTTP por motor nos dois hosts, tipos/gates/builds
aprovados. Legado ativo. Ver [onda 67](shared-api-host.md).

## Financeiro administrativo no Expo — onda 81 (2026-10-03, sem commit)

A rota /admin/financeiro usa modelos/API comuns com o web. Tabela dez,
busca/status/período/seleção/exportação, calendário diário/semanal/mensal,
indicadores, settings tributários e detalhe/ações estão disponíveis. Portas
isolam Next/DOM e Alert/compartilhamento; o DTO financeiro de calendário é puro,
sem importar o barrel de UI DOM. Os atalhos do dashboard e orçamento chegam ao
destino real, e a navegação de volta conserva search/quoteId.

202 não declara boleto/PDF pronto; vencimento pendente conserva o valor
confirmado. Ajustes/reemissão/exclusão/ofício mantêm recusas e snapshots.
Confirmação pendente é exclusiva por lançamento e não envia após troca de
escopo. Arquivos usam bytes autenticados e isCurrent, com limpeza do cache
próprio. Busca não entra na query do calendário, como no comportamento anterior.

122 casos do bloco, 62 mobile/183 web e gates locais aprovados.
Calendário/gráficos/datas/teclado/Alert/arquivo em aparelhos ainda exigem
aceite; não se certificou equivalência visual ou operação do gateway. Pendências
de agregados/CSV/exclusão final permanecem. Legado ativo.
[Resultados e limites](shared-api-host.md), onda 81; entrada 264.
