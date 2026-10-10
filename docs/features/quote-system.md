# Sistema de Orçamentos - Documentação Completa

> **⚠️ CRÍTICO**: Este documento contém todas as regras de negócio, estruturas
> de dados e fluxos do sistema de orçamentos. Consulte-o ANTES de fazer qualquer
> alteração relacionada a orçamentos.

---

## 1. Propósito

O sistema de orçamentos é o núcleo do modelo de negócio da GB-Locações. Ele
permite que clientes solicitem orçamentos para locação de equipamentos,
configurando detalhes como período, quantidade e opções de entrega.

---

## 2. Visão Geral do Fluxo

```
Página de Detalhes do Equipamento (/equipamentos/[id])
    ↓ (Configurar: quantidade, datas, período)
Adicionar ao Carrinho (SmartEquipmentPricing)
    ↓
Página de Orçamento (/orcamento)
    ↓ (Preencher: dados pessoais, entrega)
Enviar Orçamento (POST /api/quotes)
    ↓
API Processa e Salva no Banco
    ↓
Admin Recebe Notificação
    ↓
Página Admin de Orçamentos (/admin/orcamentos)
```

---

## 2.1. Diagramas Relacionados

- `docs/architecture/diagrams/quote-flow.mermaid`
- `docs/architecture/diagrams/quote-boleto-flow.mermaid`

---

## 3. Fluxo Detalhado

### 3.1. Configuração do Equipamento (Página de Detalhes)

**Localização**: `/equipamentos/[id]` **Componente Principal**:
`SmartEquipmentPricing`

**O que acontece**:

- Cliente seleciona **período de locação** usando calendário (data início e data
  fim)
- Cliente escolhe se **inclui finais de semana** na contagem de dias
- **Confirmação obrigatória**: se o cliente não selecionar datas no calendário,
  o sistema confirma a preferência de finais de semana antes de adicionar ao
  carrinho
- **Datas automáticas**: sem calendário, o período é calculado a partir da data
  da solicitação; se `includeWeekends=false` e a solicitação for em
  sábado/domingo, o início passa para o próximo dia útil e a contagem considera
  apenas dias úteis
- Sistema calcula automaticamente:
  - Número de dias úteis ou totais (dependendo da opção)
  - Período aplicado (Diário, Semanal, Quinzenal, Mensal) baseado nos dias
  - Preço final com desconto ou valor direto aplicado
- Cliente clica em "Solicitar Orçamento" e o equipamento é adicionado ao
  carrinho **COM**:
  - `startDate`: Data de início da locação
  - `endDate`: Data de fim da locação
  - `days`: Número de dias calculados
  - `includeWeekends`: Se finais de semana estão incluídos
  - `selectedPeriod`: Período aplicado (daily, weekly, biweekly, monthly)
  - `finalPrice`: Preço final calculado
  - Todos os campos de desconto e valor direto do equipamento

> **🚨 REGRA CRÍTICA**: O período de locação é configurado **INDIVIDUALMENTE**
> para cada equipamento na página de detalhes. **NÃO** existe campo de período
> global no formulário de orçamentos.

### 3.2. Página de Orçamento (`/orcamento`)

**Localização**:
`packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx`; rota fina em
`apps/clients/web/src/app/(public)/[locadora]/(vitrine)/orcamento/page.tsx`. O
modelo `pages/orcamento/model/use-quote-page.ts` concentra o fluxo comum;
`OrcamentoPage.native.tsx` fornece as portas nativas. O host não duplica a tela
nem leva Prisma ou regras financeiras para o cliente.

**O que o cliente vê**:

- Lista de equipamentos selecionados com suas respectivas datas e períodos
- Formulário de contato (nome, email, telefone, CPF/CNPJ, empresa)
- Opção de tipo de entrega (Retirada na Loja / Entrega no Endereço)
- Formulário de endereço (se entrega)
- Cálculo de frete (se entrega)
- Resumo com subtotal e total

**O que o sistema faz**:

- **Validação de Disponibilidade**: Verifica se cada equipamento está disponível
  nas datas selecionadas
- **Sincronização de Preços**: Garante que os preços no carrinho estão
  atualizados com o catálogo
- **Cálculo de Frete**: Calcula opções de frete baseado no CEP de entrega
- **Validação de Dados**: Valida CPF/CNPJ, telefone, email, endereço

**Regras de negócio obrigatórias**:

1. **Período por Item**: Cada equipamento no carrinho tem seu próprio
   `startDate`, `endDate` e `days`
2. **Validação de Datas**: Se um item não tem datas definidas, o sistema
   bloqueia o envio
3. **Disponibilidade**: Sistema valida disponibilidade de cada item nas suas
   datas específicas
4. **CPF ou CNPJ**: Pelo menos um deve ser preenchido
5. **CPF/CNPJ valido**: o formulário usa `validateCPF`/`validateCNPJ` expostos
   pela entidade orçamento. A entrada HTTP é validada pelo schema de contracts;
   essas funções de UI não devem ser descritas como uma validação fiscal
   adicional já presente em `QuoteRequestSchema`.
6. **Empresa Obrigatória**: Se CNPJ é informado, empresa é obrigatória
7. **Endereço Obrigatório**: Se tipo de entrega é DELIVERY, endereço completo é
   obrigatório

### 3.3. Envio do Orçamento

**API**: `POST /api/quotes`

**Payload enviado**:

```typescript
{
  tenantSlug: string // Locadora explícita; no host de locadora deve repetir o slug da borda
  customerName: string
  customerEmail: string
  customerPhone: string
  cpf?: string
  cnpj?: string
  customerCompany?: string
  message?: string
  deliveryType?: 'DELIVERY' | 'PICKUP'
  deliveryAddress?: AddressData
  items: Array<{
    equipmentId: string
    quantity: number
    days: number
    startDate?: string  // ISO string
    endDate?: string    // ISO string
    includeWeekends?: boolean
  }>
}
```

**O que a API faz**:

1. Valida todos os dados usando `QuoteRequestSchema` (Zod)
2. Valida disponibilidade de cada item nas suas datas específicas
3. Calcula preço inteligente para cada item usando `buildQuotePricing()`
4. Gera `quoteCode` único no padrão `Q-ANO-SEQUENCIAL` (ex.: `Q-2026-0001`)
5. Salva no banco de dados: `Quote` (orçamento principal) e `QuoteItem[]`
   (itens)
6. Na mesma transação, enfileira `quote.created.notify` na outbox com `tenantId`
   e chave de deduplicação; o 201 confirma persistência, não envio de e-mail ou
   emissão no provedor.
7. Criação, disponibilidade e preço usam a locadora resolvida antes do schema;
   um usuário de sessão associado ao pedido precisa ter vínculo CLIENT vigente
   nela. A ausência de vínculo conserva a recusa do backend.
8. Conversão e cobrança seguem as políticas de quitação/paymentTerms abaixo;
   criar um orçamento não confirma pagamento, estoque reservado ou locação.

#### 3.3.1 Boleto (Asaas)

- A criação do orçamento persiste PENDING e enfileira a notificação. A emissão
  usa os casos de cobrança/outbox; o retorno 201 da criação não declara boleto
  emitido. A operação de geração administrativa pode retornar 202 PENDING ou 200
  quando já há documento disponível.
- Se o valor final for ajustado com boleto pendente, o boleto e regenerado com o
  valor atualizado (PDF deve ser reenviado ao cliente). Desde a onda 6 so a
  cobranca `PENDING` nunca emitida muda de valor; cobranca ja emitida no
  provedor ou vencida bloqueia a edicao com 409 (secao 7.6).
- Na substituicao de cobranca por novo valor, a cobranca anterior e cancelada no
  gateway antes de vincular a nova transacao.
- Ao regenerar boleto, os metadados anteriores (ex.: envio) sao preservados.
- O financeiro admin permite alterar `dueDate` da cobranca (sincronizado no
  gateway) sem precisar recriar manualmente todo o fluxo.
- O modal de `/admin/orcamentos` tambem permite alterar vencimento do boleto
  usando o mesmo endpoint financeiro, mantendo regra unica no backend.
- Se o valor do boleto precisar ser atualizado e nao houver CPF/CNPJ, o sistema
  nao tenta regenerar automaticamente; a geracao manual retorna erro para evitar
  valor divergente.
- O clique de aprovar nao muda o status; o status so vira APPROVED quando o
  pagamento e confirmado, **exceto** no fluxo `paymentTerms=AT_END` (pagar no
  fim), em que a aprovacao operacional pode iniciar a conversao sem pagamento
  inicial.
- Se `AUTO_GENERATE_BOLETO_ON_QUOTE="true"`, o sistema tenta gerar o boleto ao
  registrar a aprovacao, mas reutiliza se ja existir.
- Boleto anterior `CANCELLED` ou `REFUNDED` nao e reutilizado: um boleto novo e
  emitido uma unica vez e a linha antiga fica intacta como historico (indice
  parcial `payments_quote_method_type_active_unique`, que so vale para cobrancas
  vigentes).
- Um `CANCELLED` local so conta como extinto com prova: sem `transactionId`, ou
  com tentativa desse `transactionId` em `CANCELLED` ou `cancellationStatus`
  `CONFIRMED`. Sem prova, a emissao consulta o provedor pela integracao Asaas
  ativa da locadora (onda 5: leitor `readTenantProviderCharge` ligado em
  `apps/services/api/src/host/payments.ts`, por
  `createTenantProviderChargeReader`, criterio em
  `packages/backend/src/modules/billing/cancelled-charges.ts`): cobranca
  removida emite um unico boleto novo; aberta com o mesmo valor e meio reativa a
  linha local sem boleto novo; ja paga reativa e confirma pela outbox;
  divergencia (inclusive um PIX `CANCELLED` ainda aberto, "outro meio") responde
  409; provedor fora do ar ou integracao sem chave, 503; chave recusada ou
  resposta fora do contrato, 502. Nenhum desses casos emite um segundo boleto
  vivo, e o mesmo criterio vale para o pedido de PIX ou boleto (entradas 187 e
  199 de `docs/issues/known-issues.md`; runbook
  `docs/guides/legacy-cents-reconciliation.md`).
- O envio para o cliente e feito manualmente pelo admin (preview + envio).
- Vencimento padrao: 3 dias uteis a partir da geracao.
- A composição atual resolve a credencial da integração ativa da locadora por
  `createIntegrationCredentialResolver`, de backend/runtime. Uma chave global
  não substitui o vínculo `TenantIntegration` nem autoriza usar a conta de outra
  locadora. Consulte o manifesto de variáveis para os nomes da família dinâmica;
  nunca registre o valor da credencial nesta documentação.
- Operação de Asaas real e infraestrutura são uma etapa posterior; testes locais
  e retirada da raiz não autorizam emissão externa.

### 3.4. Area do Cliente - Historico de Orcamentos

**Localizacao**: `/area-cliente/historico`

- O cliente pode excluir orcamentos apenas do seu historico.
- A exclusao do cliente **nao** remove o registro do admin.
- O sistema usa soft delete via `clientDeletedAt` e filtra no `GET /api/quotes`
  para ocultar somente na area do cliente.

---

## 4. Sistema de Preços Inteligente

**Localização**: `packages/frontend/src/entities/equipamento/model/preco.ts` e
`packages/frontend/src/entities/orcamento/model/preco.ts`

### 4.1. Determinação do Período

O sistema verifica quantos dias foram solicitados e aplica o período
correspondente:

| Dias       | Período Aplicado |
| :--------- | :--------------- |
| 1-6 dias   | Diário           |
| 7-14 dias  | Semanal          |
| 15-29 dias | Quinzenal        |
| 30+ dias   | Mensal           |

### 4.2. Cálculo de Preço

- **Se `useDirectValue = true`**: Usa valor direto do período
  - Exemplo: Semanal com valor direto R$ 500 → R$ 500 para 7 dias
- **Se `useDirectValue = false`**: Aplica desconto percentual
  - Exemplo: Semanal com 10% desconto → Preço diário × 7 × 0.90

### 4.3. Campos no Equipamento

```typescript
// Descontos percentuais
dailyDiscount?: number        // Desconto % para diário
weeklyDiscount?: number       // Desconto % para semanal (ex: 10)
biweeklyDiscount?: number     // Desconto % para quinzenal (ex: 15)
monthlyDiscount?: number      // Desconto % para mensal (ex: 20)

// Valores diretos (fixos)
dailyDirectValue?: number     // Valor fixo para diário
weeklyDirectValue?: number    // Valor fixo para semanal
biweeklyDirectValue?: number  // Valor fixo para quinzenal
monthlyDirectValue?: number   // Valor fixo para mensal

// Flags para usar valor direto
dailyUseDirectValue?: boolean
weeklyUseDirectValue?: boolean
biweeklyUseDirectValue?: boolean
monthlyUseDirectValue?: boolean
```

### 4.4. Precisão e arredondamento (ondas 6 e 7)

- Uma função só, no domínio: `exactIntelligentPrice`
  (`packages/domain/src/equipamento/preco.ts`) calcula o preço exato em Decimal
  a partir do texto dos valores (valor direto = valor × dias ÷ período, numa só
  divisão; senão diária × dias − desconto). Tela e servidor usam a mesma função.
- `calculateIntelligentPrice` devolve esse preço arredondado em centavos
  (`ROUND_HALF_UP`): 50,05/dia, 1 dia e 10% de desconto dá R$ 45,05.
- Total da linha = round(preço exato × quantidade), uma vez, em
  `buildQuotePricing` (`packages/domain/src/orcamento/preco.ts`): 45,05 × 3 dá
  135,14. O subtotal das páginas de orçamento e da área do cliente é
  `buildQuotePricing(...).total`, e o "Total Estimado" do carrinho
  (`getTotalPrice`) soma esses totais em Decimal; `finalPrice` não entra na
  conta. Numa linha com meio centavo, a unidade exibida × quantidade pode
  diferir 1 centavo do subtotal: regra aplicada por padrão, aguardando o aval do
  dono (`docs/architecture/modernization.md`, seção "Ondas 6 a 9"; entrada 206
  de `docs/issues/known-issues.md`).
- Pendente: `buildQuotePricing` ignora os períodos desligados (`enabledPeriods`)
  que a tela respeita.

---

## 5. Página Admin de Orçamentos

**Localização**: `packages/frontend/src/pages/orcamentos-admin`; rotas finas em
`apps/clients/web/src/app/(admin)/admin/orcamentos/page.tsx` e `[id]/page.tsx`
da mesma pasta. APIs e modelos da própria página mantêm os filtros e descartam
respostas de escopos encerrados.

### 5.1. Visões Disponíveis

- **Kanban**: Visualizacao por status (PENDING, APPROVED, REJECTED, COMPLETED).
  Para `UPFRONT/ON_DELIVERY`, APPROVED aparece apos pagamento confirmado. Para
  `AT_END`, o fluxo pode seguir para conversao sem pagamento inicial.
- **Tabela**: Lista com filtros e ordenação

### 5.2. Informações Exibidas por Item (CRÍTICO)

1. Nome do Equipamento
2. Quantidade solicitada
3. Dias de Locação (específicos daquele equipamento)
4. Período Aplicado (Diário, Semanal, Quinzenal, Mensal)
5. Desconto Aplicado (percentual) OU Valor Direto aplicado
6. Período de Locação (data início até data fim)
7. Incluir Finais de Semana (se marcado)
8. Preço Original (riscado, se houver desconto)
9. Preço Final (com desconto/valor direto aplicado)
10. Preço por Dia

### 5.4 Busca por codigo de orcamento

- A busca do admin deve aceitar no mesmo campo:
  - nome/contato do cliente
  - `quoteCode` (codigo operacional)
  - `legacyExternalCode` (codigo legado opcional)
- `quote.id` permanece interno e nao deve ser tratado como codigo de negocio no
  fluxo operacional.

### 5.3. Informações de Entrega/Retirada Exibidas

1. **Tipo de Entrega/Retirada**: Badge indicando "Entrega no Endereço"
   (DELIVERY) ou "Retirada na Loja" (PICKUP)
2. **Taxa de Entrega**: Exibida quando `deliveryFee` > 0
3. **Endereço Completo** (quando DELIVERY): Logradouro, número, complemento,
   bairro, cidade/estado, CEP
4. **Mensagem Informativa**: Quando PICKUP, exibe mensagem que cliente retirará
   na loja

---

## 6. Estrutura de Dados

### 6.1. Dados do Cliente

- Nome completo
- Email
- Telefone
- CPF (pessoa física) OU CNPJ (pessoa jurídica)
- Empresa (obrigatório se CNPJ)
- CEP
- Mensagem adicional (opcional)

### 6.2. Dados de Entrega

- Tipo: Retirada na Loja (PICKUP) ou Entrega (DELIVERY)
- Endereço completo (se DELIVERY): CEP, Logradouro, Número, Complemento, Bairro,
  Cidade, Estado

### 6.3. Schema Prisma

Trechos de `prisma/schema.prisma`, não modelos completos. A chave operacional do
orçamento é única por locadora. `tenantId` nullable existe para dados legados
sem atribuição em quarentena; pedidos novos recebem o tenant do principal/borda
resolvidos, sem aceitá-lo como escolha livre do corpo.

```prisma
model Quote {
  // ... outros campos
  tenantId          String?
  quoteCode         String?
  legacyExternalCode String?
  paymentTerms      QuotePaymentTerms @default(UPFRONT)
  deliveryType        DeliveryType?  // DELIVERY ou PICKUP
  deliveryAddress     Json?          // Endereço completo (quando DELIVERY)
  deliveryFee         Decimal?       // Taxa de entrega
  // ... outros campos
  @@unique([tenantId, quoteCode])
}

model QuoteItem {
  tenantId        String?
  id              String    @id @default(cuid())
  quoteId         String
  equipmentId     String
  quantity        Int       @default(1)
  days            Int       @default(1)
  pricePerDay     Decimal
  total           Decimal
  // Datas específicas deste item
  startDate       DateTime?
  endDate         DateTime?
  // Finais de semana
  includeWeekends Boolean   @default(false)
  // Informações de preço
  appliedDiscount Decimal?  // Desconto % aplicado
  appliedPeriod   String?   // daily, weekly, biweekly, monthly
  useDirectValue  Boolean   @default(false)
  directValue     Decimal?  // Valor direto aplicado
}
```

---

## 7. Subsistemas Relacionados

### 7.1. Ajuste de Valor Final com Justificativa

**Documentação**: `docs/features/quote-price-adjustment.md`

Sistema que permite admin editar valor final do orçamento com justificativa
obrigatória. Cliente sempre vê valor original vs valor final editado.

**Regras**:

- Admin pode editar valor total do orçamento
- Justificativa é OBRIGATÓRIA ao editar valor
- Sistema salva: `originalTotal`, `finalTotal`, `priceAdjustmentReason`,
  `priceAdjustedAt`, `priceAdjustedBy`
- Desde a onda 6, o valor final manual também vira um reajuste `OTHER` da
  diferença, com a justificativa, para que a regra única da obrigação (seção
  7.6) o mantenha nas edições seguintes. Ele aparece na lista de reajustes, no
  portal do cliente e no PDF de reajuste.

**API**: `PATCH /api/admin/quotes/[id]` com
`{ finalTotal, priceAdjustmentReason }`

### 7.2. Multa por Atraso

**Documentação**: `docs/features/late-fee-calculation.md`

Sistema que calcula automaticamente multa por atraso, mas requer aprovação do
admin para ser aplicada.

**Regras**:

- Sistema calcula automaticamente valor da multa
- Admin DEVE aprovar aplicação da multa
- Integra com ajuste de valor final
- Desde a onda 6, a multa aprovada entra na obrigação uma vez só: aprovar de
  novo não soma, trocar a multa aprovada substitui e revogar tira a multa do
  valor final (seção 7.6). Multa inválida responde 400 ("Valor de multa
  inválido").

**API**:

- `POST /api/admin/quotes/[id]/calculate-late-fee`: Calcula multa
- `PATCH /api/admin/quotes/[id]` com `{ lateFee, lateFeeApproved }`: Aprova
  multa

**Cálculo puro**: `packages/domain/src/orcamento/multa.ts`, exportado por
`@gb-locacoes/domain/orcamento`. A simulação administrativa é
`calculateQuoteLateFee` em backend/quotations/administration, composta pelo host
API; não grava multa. A aprovação passa pelo caso de atualização do orçamento,
que recalcula a obrigação em centavos. O padrão conserva 2% ao dia, 30 dias de
cálculo, mínimo R$ 50 e máximo R$ 5.000.

### 7.3. Registro de Perdas de Peças

**Documentação**: `docs/features/equipment-parts-loss.md`

Sistema para registrar perdas de peças dos equipamentos. Usado para cobrar taxas
no orçamento final.

### 7.4. Bloqueio de Estoque

**Documentacao**: `docs/features/quote-stock-blocking.md`

Sistema que bloqueia estoque somente apos pagamento confirmado; aprovacao do
admin nao muda status.

**Regras**:

- Nao bloqueia durante criacao (orcamentos PENDING nao bloqueiam)
- Nao bloqueia apenas por aprovacao do admin no fluxo `UPFRONT/ON_DELIVERY`
  (status permanece PENDING)
- Bloqueia apos pagamento confirmado
- Validacao server-side sempre antes de criar

**Logica**: `packages/backend/src/modules/rentals/availability.ts`
(`createRentalAvailability`, exportado por `@gb-locacoes/backend/rentals`).
Composição em `apps/services/api/src/host/quotations.ts` e `host/rentals.ts`; as
consultas e locks ficam no backend, sob o contexto da locadora.

#### 7.4.1. Quitacao vigente (conversao, check-out e estoque)

`isObligationSettled(total, payments)` em
`packages/domain/src/locacao/reserva.ts` decide se o orcamento esta pago. A
mesma regra vale na conversao orcamento→locacao (sobre `finalTotal ?? total`),
em `hasCheckoutPayment` e em `blocksRentalInventory`:

- considera so cobrancas `RENTAL` e `DEPOSIT`;
- ignora `CANCELLED` e `REFUNDED` (historico preservado pela migration
  `202609260004`);
- exige ao menos uma `PAID`, todas as vigentes `PAID` e saldo em centavos menor
  ou igual a zero: `obligationBalance(total, pagos)` em
  `packages/domain/src/locacao/saldo.ts` (total em centavos menos a soma paga em
  centavos, `ROUND_HALF_UP`).

A mesma funcao de saldo decide o valor da cobranca (`resolvePaymentObligation`)
e o saldo do boleto na conversao, que grava `rentals.total` em centavos. Assim
um total fracionario (ex.: 128.5714...) pago pelo valor cobrado (128.57) fica
quitado dos dois lados. Totais, multas por atraso, ajustes, prorrogacoes,
avarias e locacao manual sao arredondados em centavos na origem; a taxa diaria
de referencia mantem a precisao original (entrada 186 de
`docs/issues/known-issues.md`).

Uma cobranca `PENDING`/`OVERDUE` esquecida continua bloqueando a conversao mesmo
com o total pago; cancelar essa cobranca destrava. Essa versao conservadora
aguarda confirmacao do usuario (alternativa: soma pura, como
`resolvePaymentObligation`).

Implementacao em `@gb-locacoes/backend/rentals` (conversao, disponibilidade) e
`@gb-locacoes/backend/quotations` (boleto); as composições atuais são
`apps/services/api/src/host/quotations.ts`, `rentals.ts` e `payments.ts`.
Domínio puro não contém persistência, leitura de sessão ou credenciais.
Validacao: `tests/unit/quote-settlement-database.test.ts` e
`tests/unit/rental-reservation.test.ts`.

### 7.5. Acompanhamento de Status

**Documentação**: `docs/features/quote-status-tracking.md`

**Status disponíveis**:

- `PENDING`: Aguardando analise; inclui aprovados pelo admin aguardando
  pagamento
- `APPROVED`: Pagamento confirmado (Asaas) **ou** aprovacao operacional no fluxo
  `AT_END`
- `REJECTED`: Rejeitado pelo admin
- `COMPLETED`: Convertido em locação

### 7.6. Obrigação do orçamento: regra única (ondas 6 e 7)

**Regra**: `quoteObligation` (`packages/domain/src/orcamento/obrigacao.ts`).
Quanto o cliente deve pelo orçamento = itens + frete (`quoteItemsAndFreight`, o
`total`) + reajustes vigentes (o TRAVEL já está no frete) + multa aprovada, uma
vez só; soma em Decimal e arredondamento único em centavos (`ROUND_HALF_UP`).

- Toda edição de dinheiro no `PATCH /api/admin/quotes/[id]`
  (`packages/backend/src/modules/quotations/update.ts`) e na API de reajustes
  (`adjustments.ts`) recalcula a obrigação a partir do estado atual, nunca
  somando sobre um `finalTotal` que já tem a multa nem sobre um `originalTotal`
  antigo. Remover item e mudar datas recalculam `total` (itens + frete) e
  `originalTotal`.
- `total`, `deliveryFee`, `pickupFee` e `lateFee` entram em centavos; valor
  inválido responde 400 ("Valor total inválido", "Valor de frete inválido",
  "Valor de multa inválido").
- Valor final legado que a regra não explica (`quoteObligationResidual`) é
  preservado na próxima edição como reajuste `OTHER` "Ajuste anterior do valor
  final": o valor devido nunca muda em silêncio, só pelo que a edição mexe.
- Cobranças base (`RENTAL`/`DEPOSIT`) seguem a nova obrigação pela regra
  `planQuoteBaseCharges`, aplicada em
  `packages/backend/src/modules/quotations/base-charges.ts` sob a trava
  `:issue:<paymentId>` de cada uma:
  - a única cobrança `PENDING` nunca emitida (sem `transactionId`,
    `boletoIssuedAt`, `pixCode` nem tentativa) passa a cobrar o saldo, com o
    detalhamento tributário recalculado;
  - cobrança paga nunca muda de valor; o saldo é cobrado à parte;
  - cobrança emitida ou vencida, mais de uma pendente, obrigação abaixo do que
    já foi pago ou saldo zerado com pendente viva: 409
    `PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION` antes de qualquer escrita. O
    valor de um boleto ou PIX vivo no provedor nunca muda por edição;
  - orçamento convertido recusa também a pendente nunca emitida (a locação é
    dona das cobranças).
- A rota devolve `{ error, code }`, e a tela do admin mostra a mensagem do
  servidor quando a aprovação da multa falha.
- `quote.boleto.ensure` só é enfileirado para orçamento aprovado sem cobrança
  base de outro meio (o consumidor recusaria os outros).
- Pendentes: orçamento convertido não recusa `lateFee`/`lateFeeApproved` no
  `PATCH`; o vencimento do boleto depende do fuso do servidor.

Validação: `tests/unit/quote-obligation-edits.test.ts` (inclui a concorrência da
trava `:issue:`, esperando no `pg_locks`),
`packages/domain/src/orcamento/obrigacao.test.ts` e
`tests/unit/quotes-http.test.ts`. Histórico: entradas 205 e 206 de
`docs/issues/known-issues.md`.

---

## 8. Arquivos Principais

| Arquivo                                                                     | Propósito                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx`            | Tela web pública                                             |
| `packages/frontend/src/pages/orcamento/ui/OrcamentoPage.native.tsx`         | Tela nativa e portas da plataforma                           |
| `packages/frontend/src/pages/orcamento/model/use-quote-page.ts`             | Fluxo comum de pedido, escopo e endereços                    |
| `packages/frontend/src/pages/orcamento/api/quote-api.ts`                    | Transporte configurado, sem regras financeiras               |
| `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/orcamento/page.tsx` | Rota fina da vitrine                                         |
| `packages/frontend/src/pages/orcamentos-admin`                              | Modelos/API e variantes web/native administrativas           |
| `apps/clients/web/src/app/(admin)/admin/orcamentos/page.tsx`                | Rota fina administrativa                                     |
| `apps/services/api/src/app/api/quotes/route.ts`                             | Listagem privada e criação com locadora explícita            |
| `apps/services/api/src/app/api/admin/quotes/route.ts`                       | Lista administrativa com QUOTES/READ                         |
| `apps/services/api/src/host/quotations.ts`                                  | Composição de casos de orçamento e transações                |
| `packages/contracts/src/quotations.ts`                                      | Schemas públicos; export `@gb-locacoes/contracts/quotations` |
| `packages/domain/src/equipamento/preco.ts`                                  | Preço exato em Decimal                                       |
| `packages/domain/src/orcamento/obrigacao.ts`                                | Obrigação única, reajustes e multa aprovada                  |
| `packages/domain/src/orcamento/multa.ts`                                    | Cálculo puro e configuração padrão de multa                  |
| `packages/backend/src/modules/quotations/quote-request.ts`                  | Persistência, catálogo, locks e outbox por tenant            |
| `packages/backend/src/modules/quotations/base-charges.ts`                   | Cobranças base sob a trava `:issue:`                         |
| `packages/backend/src/modules/rentals/availability.ts`                      | Disponibilidade e estoque por locadora                       |
| `packages/frontend/src/entities/equipamento/model/preco.ts`                 | Consumo dos cálculos de equipamento                          |
| `packages/frontend/src/entities/orcamento/model/preco.ts`                   | Consumo dos cálculos de orçamento                            |
| `packages/frontend/src/features/carrinho/model/carrinho.ts`                 | Contrato de item do carrinho                                 |
| `prisma/schema.prisma`                                                      | Models de persistência Quote/QuoteItem                       |

## 9. Armadilhas a Evitar

- ❌ **NUNCA** adicione campo de período global no formulário de orçamentos
- ❌ **NUNCA** remova a validação de datas por item
- ❌ **NUNCA** modifique o cálculo de preço sem entender o sistema inteligente
- ❌ **NUNCA** remova campos de desconto/valor direto do schema
- ❌ **NUNCA** exiba apenas quantidade e preço sem mostrar período, desconto e
  datas
- ❌ **NUNCA** assuma que todos os itens têm o mesmo período
- ❌ **NUNCA** omita informações de entrega/retirada na API admin
- ❌ **NUNCA** acesse `deliveryAddress` sem verificar se é objeto válido (use
  type guards)
- ❌ **NUNCA** exiba endereço quando `deliveryType` for PICKUP
- ❌ **NUNCA** some multa, frete ou reajuste sobre o `finalTotal` gravado:
  recalcule a obrigação por `quoteObligation` (seção 7.6)
- ❌ **NUNCA** mude o valor de uma cobrança já emitida no provedor por edição do
  orçamento (409 `PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION`)

---

## 10. Boas Práticas

- ✅ **SEMPRE** valide que cada item tem datas definidas
- ✅ **SEMPRE** exiba todas as informações detalhadas por item no admin
- ✅ **SEMPRE** exiba informações de entrega/retirada quando disponíveis
- ✅ **SEMPRE** use `buildQuotePricing()` para calcular preços
- ✅ **SEMPRE** salve todos os campos de preço por item no banco
- ✅ **SEMPRE** valide disponibilidade usando as datas específicas de cada item
- ✅ **SEMPRE** mantenha a estrutura de dados completa no `QuoteItem`
- ✅ **SEMPRE** retorne `deliveryType`, `deliveryAddress` e `deliveryFee` na API
  admin
- ✅ **SEMPRE** use type guards ao acessar `deliveryAddress` (tipo Json do
  Prisma)

---

## 11. Histórico de Alterações

| Data       | Descrição                                                                       | Autor  |
| :--------- | :------------------------------------------------------------------------------ | :----- |
| 2026-09-30 | Regra única da obrigação, preço exato em Decimal e total da linha (ondas 6 e 7) | IA     |
| 2026-09-29 | Leitor do provedor ligado e criterio de prova no billing (onda 5, sem commit)   | IA     |
| 2026-09-26 | Saldo em centavos e reemissao so com prova (onda 4, `4b02f52f`)                 | IA     |
| 2026-09-26 | Quitacao vigente e reemissao de boleto (onda 2, `da19f601`)                     | IA     |
| 2026-02-14 | Fluxo `paymentTerms` com excecao `AT_END` na aprovacao                          | IA     |
| 2026-02-11 | `quoteCode` operacional e busca por código no admin                             | IA     |
| 2026-01-02 | Status APPROVED apenas apos pagamento confirmado                                | IA     |
| Jan 2025   | Implementação inicial do sistema de orçamentos                                  | Equipe |
| Jan 2025   | Adição do sistema de entrega/retirada                                           | Equipe |
| Jan 2025   | Sistema de ajuste de valor final com justificativa                              | Equipe |
| Jan 2025   | Sistema de multa por atraso                                                     | Equipe |
| Jan 2025   | Registro de perdas de peças                                                     | Equipe |
| Jan 2025   | Bloqueio de estoque                                                             | Equipe |
| Jan 2025   | Acompanhamento de status                                                        | Equipe |

---

_Última atualização: 2026-10-02 (incremento local, sem commit)_

## Host compartilhado — onda 34

Registro histórico da onda 34: GET/DELETE /api/quotes/[id] e GET
/api/admin/quotes e /[id] também estavam compostos em apps/services/api. As
regras permanecem nas factories existentes de backend/quotations; os clientes
continuam consumindo a origem legada.

O detalhe do cliente conserva posse por usuário/locadora, Decimals numéricos,
status lowercase e metadata de pagamento nula quando REJECTED. DELETE apenas
oculta o histórico; não cancela orçamento, locação ou cobrança. A lista admin
exige QUOTES/READ, conserva filtros/paginação e no-store; o detalhe exige
ADMIN/OPERATOR do vínculo. Essa diferença de política foi preservada. Demais
escritas, listagem do cliente, pagamentos e documentos continuam legados.

Paridade HTTP compilada, sessão real nos dois modos e RLS foram verificadas em
bloco ao final da onda. Evidências e limites em
[API compartilhada](shared-api-host.md), seção da onda 34.

## Host compartilhado — lista do cliente (onda 35)

Registro histórico da onda 35: GET /api/quotes também foi montado no serviço. A
query e transformação antes presentes no handler legado pertencem a
quotations/client-portal, compartilhadas por ambos os adapters. Mantém posse por
tenant/usuário, exclusão de linhas ocultas, números, datas ISO, status lowercase
e ordenação. Header privado e Vary Cookie/x-tenant-id preservados. A lista
conserva metadata dos pagamentos como antes; a política de REJECTED do detalhe
continua específica daquele contrato.

No checkpoint da onda 35, POST público e demais mutações administrativas de
orçamento continuavam somente legados; a onda 36 abaixo monta os mesmos casos de
uso no serviço. Paridade compilada com sessão real nos dois modos e resultados
da onda em [API compartilhada](shared-api-host.md), seção da onda 35.

## Host compartilhado — mutações de orçamento (onda 36)

Registro histórico da onda 36: POST /api/quotes e PATCH/DELETE
/api/admin/quotes/[id], GET/POST adjustments, DELETE adjustments/[adjustmentId],
POST calculate-late-fee, convert-to-rental e send-adjusted-quote estão também
montados no serviço parcial. Casos de uso de quotations/rentals continuam
autoritativos; quatro schemas existentes são comuns em contracts/quotations.
Nesse checkpoint histórico, a fachada a antiga `lib/validations`, retirada em F,
ainda mantinha o export público; após a retirada da raiz, os adapters importam
diretamente `@gb-locacoes/contracts/quotations`. A composição atual
correspondente é `apps/services/api/src/host/quotations.ts`.

As diferenças de papel/permissão do legado foram conservadas. Reajustes usam
centavos e preservam histórico; DELETE desse histórico retorna 409. Simulação de
multa não grava nada. Conversão usa a mesma quitação, estoque, lock e SAVEPOINT
e não emite boleto, mesmo quando generateBoleto chega true. A fila de conversão
é quote.status.notify com aggregateId do orçamento e status COMPLETED. Envio
ajustado e criação pública apenas persistem e enfileiram; não invocam
provedores. Cliente opcional da criação exige membership CLIENT vigente e
conserva 404 customer_not_found para quem não pertence à locadora.

Falha inesperada no DELETE passa a devolver 500 genérico sem mensagem interna
nos dois adapters (entrada 235). Sucesso, erros de negócio e histórico
financeiro preservados. Sessão real nos dois modos, RLS, concorrência, preço do
catálogo e rollback SQL foram verificados ao final do bloco. Evidências,
rechecagens e limites na onda 36 de [API compartilhada](shared-api-host.md).
Emissão, reconciliação externa, documentos e jobs permanecem legados; sem
cutover.

## Transporte compartilhado do consumidor (onda 62, 2026-10-03)

OrcamentoPage e QuoteForm usam o cliente HTTP fornecido pelo bootstrap. O
segmento pages/orcamento/api contém somente transporte: catálogo e
disponibilidade levam tenantSlug, criação leva o mesmo slug no corpo e os
privados usam a seleção capturada pelo cliente. Sem locadora explícita, a
tentativa falha antes do HTTP. Não há nova regra de cálculo, ownership ou
validação no host ou em shared.

Perfil, endereços e preferências de confirmação são isolados por
locadora/usuário. Respostas de escopos encerrados não alteram outro carrinho nem
continuam cadeias de escrita. Falha de envio conserva os itens para tentar de
novo; salvamentos paralelos conservam os resultados parciais. O catálogo hidrata
os itens atuais, sem recolocar uma linha removida durante a leitura. Preços,
termos, datas, WhatsApp e layout foram preservados. O orçamento nativo completo
e o aceite interativo ainda são pendências; transporte universal não prova
paridade mobile.

Provas e limites: [onda 62 da API compartilhada](shared-api-host.md).

## Transporte privado único (onda 63, 2026-10-03)

Perfil e endereços do orçamento delegam à entidade cliente, também consumida
pelas telas privadas completas. O ciclo de requisição foi extraído para a
fundação useScopedApiClient; o hook do orçamento conserva a chave de locadora.
Guard de slug, builder, rotas públicas, valores, envelopes e fluxo renderizado
não mudaram. Provas da onda 62 e transporte HTTP do orçamento passaram novamente
nos dois hosts/motores. Ver [onda 63](shared-api-host.md).

## Seleção no detalhe nativo (onda 73, 2026-10-03, sem commit)

O detalhe Expo usa os mesmos modelos de seleção/período/confirmação do web.
Preserva direto zero, períodos desabilitados, calendário até dez anos, contagem
por dias úteis ou todos os dias e espera da sessão. Datas explícitas evitam a
confirmação redundante; sem datas/preferência confirmada, o diálogo precede
addItem. Nenhuma regra de preço foi copiada para o host.

A página /orcamento no Expo ainda está pendente. Selecionar/adicionar
equipamento não certifica que o orçamento pode ser enviado no app. A próxima
onda deve compartilhar o modelo completo da página web e suas
confirmações/endereço/termos. Provas locais e limitações:
[onda 73](shared-api-host.md).

## Orçamento no Expo (onda 74, 2026-10-03, sem commit)

A pendência de /orcamento da onda 73 foi implementada: rota Expo fina monta
OrcamentoPage.native na slice existente. use-quote-page compartilha o estado e
as regras anteriores com a apresentação web; preferências assíncronas são portas
do host, com chave de locadora/usuário e erro/retry antes do modelo. QuoteForm,
formulário alternativo, também tem modelo comum e variante native.

Itens, preços, limites, datas/disponibilidade, dados/documentos,
entrega/retirada/endereço/frete, termos e confirmações usam entidades e
transportes existentes. POST /api/quotes e /api/orcamentos preservados. Falha de
envio conserva o carrinho; mudança de locadora/usuário/transporte encerra o
ciclo anterior. A retomada de fins de semana usa o estado atualizado.

529 atributos das apresentações web preservados por AST; testes web/nativos,
tipos e builds aprovados. Frete/origem fixa e Google Customer Reviews conservam
as limitações anteriores; foco e seleção de endereço exigem aceite interativo.
Nenhum recebimento/abertura de WhatsApp ou aparelho certificado. Provas e
limites: [onda 74](shared-api-host.md). Legado/scheduler ativos, sem cutover.
