# Preservação de Datas Individuais por Item (Quote → Rental)

## Contexto

**Problema Resolvido:** Antes desta implementação, quando um orçamento (Quote)
era convertido para locação (Rental), as datas individuais de cada item
(`startDate`, `endDate`, `includeWeekends`) eram perdidas. Isso causava
problemas para locações onde diferentes equipamentos tinham períodos diferentes.

**Impacto no Negócio:**

- Cliente aluga 3 equipamentos com períodos diferentes (5, 10, 7 dias)
- Sistema perdia essa informação e usava apenas período global
- Resultado: cálculo incorreto de disponibilidade e cobrança

**Data de Implementação:** 2026-02-14 **Severidade:** 🔴 P0 - CRÍTICA (Perda de
Dados)

---

## Solução Implementada

### 1. Migração do Schema (Task 1.2)

Adicionados novos campos à tabela `rental_items`:

```prisma
model rental_items {
  // ... campos existentes ...

  // Datas específicas deste item (nullable para compatibilidade)
  startDate       DateTime? @db.Timestamp(6)
  endDate         DateTime? @db.Timestamp(6)
  includeWeekends Boolean   @default(false)

  // Índices para otimização de consultas
  @@index([startDate])
  @@index([endDate])
}
```

**Decisões Técnicas:**

- Campos `nullable` para compatibilidade com rentals existentes
- Índices criados para consultas de disponibilidade
- Tipo `Timestamp(6)` para precisão de microssegundos

**Arquivo:** `prisma/schema.prisma` (linhas 407-409, 418-419)

---

### 2. Atualização do Rental Converter (Task 1.3)

#### 2.1. Query Prisma com Select Explícito

**Problema:** A query usava `include` que não retornava os novos campos.

**Solução:** Mudança para `select` explícito

```typescript
// Código histórico de 2026-02-14: arquivo antigo lib/rental-converter.ts, retirado em F (linhas 48-71).
items: {
  select: {
    id: true,
    equipmentId: true,
    quantity: true,
    days: true,
    pricePerDay: true,
    total: true,
    // CRÍTICO: Incluir datas individuais de cada item
    startDate: true,
    endDate: true,
    includeWeekends: true,
    equipment: {
      select: {
        id: true,
        name: true,
        maxStock: true,
      },
    },
  },
},
```

#### 2.2. Preservação de Datas na Criação dos rental_items

```typescript
// Código histórico de 2026-02-14: arquivo antigo lib/rental-converter.ts, retirado em F (linhas 106-144).
rental_items: {
  create: quote.items.map((item) => ({
    id: `rental_item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    equipmentid: item.equipmentId,
    quantity: item.quantity,
    priceperday: new Decimal(item.pricePerDay.toString()).toNumber(),
    totaldays: item.days,
    totalprice: new Decimal(item.total.toString()).toNumber(),

    // CRÍTICO: Preservar datas individuais do quote_item
    startDate: item.startDate || quote.startDate || globalStartDate,
    endDate: item.endDate || quote.endDate || globalEndDate,
    includeWeekends: item.includeWeekends ?? false,
  })),
}
```

#### 2.3. Cálculo de Datas Globais do Rental

As datas globais do rental são calculadas como MIN/MAX das datas dos itens:

```typescript
// Código histórico de 2026-02-14: arquivo antigo lib/rental-converter.ts, retirado em F (linhas 94-103).
const itemStartDates = quote.items
  .map((i) => i.startDate || quote.startDate)
  .filter((d): d is Date => d !== null)

const itemEndDates = quote.items
  .map((i) => i.endDate || quote.endDate)
  .filter((d): d is Date => d !== null)

const globalStartDate = itemStartDates.length
  ? new Date(Math.min(...itemStartDates.map((d) => d.getTime())))
  : new Date()

const globalEndDate = itemEndDates.length
  ? new Date(Math.max(...itemEndDates.map((d) => d.getTime())))
  : new Date()
```

**Owner atual:** `packages/backend/src/modules/rentals/conversion.ts`, composto
por `apps/services/api/src/host/rentals.ts` com `createQuoteConversion`. Os três
exemplos acima preservam o snapshot de 2026-02-14, inclusive seus ids e
fallbacks; não são receitas para reinstalar o arquivo antigo. Hoje a query
inclui os itens da locadora; a conversão resolve cada data com `??` para a data
do Quote e recusa item sem início/fim, antes da disponibilidade. Copia as datas
resolvidas e `includeWeekends` ao `rental_items` e calcula MIN/MAX sobre esses
itens. Contexto/lock/idempotência/valores em centavos continuam no backend;
nenhum fallback para o relógio atual substitui datas ausentes.

---

## Fluxo de Dados

### Quote → Rental Conversion Flow

```
QuoteItem                    rental_items
---------                    ------------
startDate: 2026-03-10   →   startDate: 2026-03-10
endDate: 2026-03-15     →   endDate: 2026-03-15
includeWeekends: true   →   includeWeekends: true
days: 5                 →   totaldays: 5

QuoteItem                    rental_items
---------                    ------------
startDate: 2026-03-10   →   startDate: 2026-03-10
endDate: 2026-03-20     →   endDate: 2026-03-20
includeWeekends: false  →   includeWeekends: false
days: 10                →   totaldays: 10

QuoteItem                    rental_items
---------                    ------------
startDate: 2026-03-15   →   startDate: 2026-03-15
endDate: 2026-03-22     →   endDate: 2026-03-22
includeWeekends: true   →   includeWeekends: true
days: 7                 →   totaldays: 7

rentals (global dates calculated from items)
-------
startdate: 2026-03-10 (MIN of all item startDates)
enddate: 2026-03-22   (MAX of all item endDates)
```

---

## Testes

### Teste Manual de Validação

1. Criar Quote com 3 itens com períodos diferentes:
   - Item 1: 5 dias (2026-03-10 a 2026-03-15, weekends: true)
   - Item 2: 10 dias (2026-03-10 a 2026-03-20, weekends: false)
   - Item 3: 7 dias (2026-03-15 a 2026-03-22, weekends: true)

2. Configurar Quote:
   - `paymentTerms: 'AT_END'` (conversão automática)
   - `userId`: vinculado a cliente

3. Aprovar Quote via `/api/admin/quotes/{id}` com `status: 'APPROVED'`

4. Verificar rental_items:

   ```sql
   SELECT id, totaldays, "startDate", "endDate", "includeWeekends"
   FROM rental_items
   WHERE rentalid = '{rental_id}'
   ORDER BY totaldays;
   ```

5. **Resultado Esperado:**
   - ✅ Todos os rental_items têm `startDate` e `endDate` não-null
   - ✅ Datas correspondem exatamente às do QuoteItem original
   - ✅ rental.startdate = 2026-03-10 (MIN)
   - ✅ rental.enddate = 2026-03-22 (MAX)

### Scripts de Teste

- `scripts/check-rental-dates.ts` - Verifica datas em rental_items
- `scripts/test-quote-system.ts dates` - Cria quote de teste com datas
  individuais

---

## Compatibilidade

### Rentals Existentes

Os campos adicionados são `nullable`, portanto rentals existentes continuam
funcionando:

- `startDate: null` - Usa rental.startdate global
- `endDate: null` - Usa rental.enddate global
- `includeWeekends: false` - Valor padrão

### Backfill de Dados Antigos (Opcional)

Se necessário, pode-se popular os campos vazios com as datas globais:

```sql
UPDATE rental_items
SET "startDate" = rentals.startdate,
    "endDate" = rentals.enddate
FROM rentals
WHERE rental_items.rentalid = rentals.id
  AND rental_items."startDate" IS NULL;
```

⚠️ **Nota:** Isso pode não refletir os períodos reais se os itens originalmente
tinham datas diferentes.

---

## Monitoramento

### Queries para Verificação

1. **Rentals com items sem datas:**

   ```sql
   SELECT COUNT(*)
   FROM rental_items
   WHERE "startDate" IS NULL OR "endDate" IS NULL;
   ```

2. **Rentals criados após o fix:**

   ```sql
   SELECT COUNT(*)
   FROM rental_items
   WHERE createdat >= '2026-02-14'
     AND "startDate" IS NOT NULL;
   ```

3. **Verificar consistência de datas:**
   ```sql
   SELECT r.id, r.startdate, r.enddate,
          MIN(ri."startDate") as min_item_start,
          MAX(ri."endDate") as max_item_end
   FROM rentals r
   JOIN rental_items ri ON ri.rentalid = r.id
   WHERE r.createdat >= '2026-02-14'
   GROUP BY r.id, r.startdate, r.enddate
   HAVING r.startdate != MIN(ri."startDate")
      OR r.enddate != MAX(ri."endDate");
   ```

---

## Referências

- **Auditoria Original:**
  `docs/audit/gb-locacoes-auditoria-completa-2026-02-14.md`
- **Plano de Implementação:**
  `C:\Users\harry\.claude\plans\floofy-splashing-milner.md`
- **CHANGELOG:** `CHANGELOG.md` (2026-02-14)
- **Issue Relacionada:** Sprint 1, Task 1.2 e 1.3 (P0 - Crítica)

---

## Autores

- **Implementação:** Claude Sonnet 4.5 + Harry (usuário)
- **Data:** 2026-02-14
- **Reviewed by:** Teste manual completo validado com sucesso
