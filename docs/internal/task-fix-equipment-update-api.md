# Tarefa: Corrigir erro "Invalid prisma.equipment.update() invocation" na API de edição de equipamento

## Objetivo

Fazer com que a rota `PUT /api/admin/equipments/[id]` salve o equipamento sem
lançar erro 500. O Prisma está rejeitando a chamada `prisma.equipment.update()`
com a mensagem **"Invalid `prisma.equipment.update()` invocation"**.

---

## Contexto do projeto

- **App:** Next.js 16 (App Router), TypeScript, Prisma 7.x
- **Banco:** PostgreSQL (Supabase)
- **Prisma:** Usa **driver adapter** `@prisma/adapter-pg` + `pg` (não usa o
  engine binário direto)
- **Arquivo da API:** `app/api/admin/equipments/[id]/route.ts` — método `PUT`
- **Formulário que chama a API:** `app/admin/equipamentos/[id]/editar/page.tsx`
  — envia `JSON.stringify(formData)` no body

---

## O que foi implementado antes do erro

Foi adicionada a funcionalidade de **ativar/desativar oferta de locação por
período** (diário, semanal, quinzenal, mensal). Isso exigiu:

1. **Schema Prisma** (`prisma/schema.prisma`): novos campos no model
   `Equipment`:
   - `dailyRentalEnabled   Boolean @default(true)`
   - `weeklyRentalEnabled  Boolean @default(true)`
   - `biweeklyRentalEnabled Boolean @default(true)`
   - `monthlyRentalEnabled Boolean @default(true)`

2. **Banco:** `pnpm db:push` já foi executado; as colunas existem no PostgreSQL.

3. **API PUT:** O handler monta um objeto `updateData` (tipo
   `Record<string, unknown>`) e chama:

   ```ts
   const equipment = await prisma.equipment.update({
     where: { id },
     data: updateData,
     include: { category: true, _count: { ... } },
   })
   ```

   Em `updateData` são atribuídos, entre outros:
   - Campos escalares (name, description, available, maxStock, discounts,
     popularPeriod, booleans de useDirectValue e rentalEnabled, etc.)
   - `pricePerDay`: já convertido para
     `new Prisma.Decimal(parseFloat(pricePerDay))`
   - `dailyDirectValue`, `weeklyDirectValue`, `biweeklyDirectValue`,
     `monthlyDirectValue`: já convertidos para `new Prisma.Decimal(...)`
   - `category`: `{ connect: { id: categoryId } }`
   - `images`: `{ set: images }` (array de strings)
   - `specifications`: objeto ou `{}`

4. **Front-end:** O `formData` inclui todos os campos do equipamento (incluindo
   os novos `*RentalEnabled`). Não há remoção de campos antes do
   `JSON.stringify(formData)`.

---

## Erro atual

- **HTTP:** 500 Internal Server Error
- **Corpo da resposta:** JSON com `error` contendo a mensagem do Prisma, que
  começa com:
  - `Invalid \`prisma.equipment.update()\` invocation in ...`
  - A mensagem é truncada no console do cliente, mas no servidor o stack aponta
    para a linha do
    `prisma.equipment.update({ where: { id }, data: updateData, ... })`.

Ou seja: a **invocação** do `update()` está sendo considerada inválida pelo
Prisma (tipos, forma do `data` ou do `where`).

---

## Payload que está sendo enviado ao Prisma (trecho relevante)

Conteúdo típico de `data` no momento do erro (baseado na mensagem de erro e no
código):

- `name`, `description`: strings
- `pricePerDay`: `new Prisma.Decimal("500")`
- `category`: `{ connect: { id: "bdc17faa-2fab-42e1-b178-eec7a32dc4c7" } }`
- `specifications`: `{}`
- `images`: `{ set: [ "https://..." ] }`
- `available`: false
- `maxStock`: 1
- `dailyDiscount`: 0, `weeklyDiscount`: 10, `biweeklyDiscount`: 15,
  `monthlyDiscount`: 20
- `popularPeriod`: "weekly"
- `dailyDirectValue`, `weeklyDirectValue`, `biweeklyDirectValue`,
  `monthlyDirectValue`: `new Prisma.Decimal("...")`
- `dailyUseDirectValue`, `weeklyUseDirectValue`, `biweeklyUseDirectValue`,
  `monthlyUseDirectValue`: boolean
- `dailyRentalEnabled`, `weeklyRentalEnabled`, `biweeklyRentalEnabled`,
  `monthlyRentalEnabled`: boolean (adicionados ao body pelo form)

O `where` é `{ id: "<cuid do equipamento>" }` (ex.:
`"cmdt2hbua0003f3bc815prsar"`).

---

## O que já foi tentado

1. Garantir que o banco tem as colunas (`db:push`) — feito.
2. Converter campos Decimal para `Prisma.Decimal` (pricePerDay e os quatro
   \*DirectValue) — feito; o erro persiste.
3. Melhorar o tratamento de erro no cliente e na API (resposta JSON com `error`
   e `details`) — feito; a mensagem do Prisma chega no corpo do 500.

Nada disso removeu o "Invalid invocation".

---

## O que você precisa fazer

1. **Identificar a causa exata** do "Invalid `prisma.equipment.update()`
   invocation":
   - Pode ser tipo incompatível com o `EquipmentUpdateInput` /
     `EquipmentUncheckedUpdateInput` (ex.: algum campo que o Prisma não aceita
     nessa forma quando usa adapter pg).
   - Pode ser mistura de input “relational” com “unchecked” (ex.: usar
     `category: { connect }` junto com algo que o tipo não permite).
   - Pode ser tipo do `id` em `where` (ex.: tipo diferente de string/CUID).
   - Pode ser restrição do driver adapter (ex.: formato de Decimal, ou algum
     tipo que o runtime do Prisma rejeita com o adapter pg).

2. **Ajustar a rota PUT** em `app/api/admin/equipments/[id]/route.ts` para que:
   - O `update()` seja feito com um `data` (e, se aplicável, `where`) que o
     Prisma aceite **sem** lançar "Invalid invocation".
   - A resposta de sucesso e o formato atual (incluindo `include`, conversão de
     `pricePerDay` e `available` para o front) sejam mantidos.

3. **Não alterar** o comportamento do formulário de edição (campos, desativar
   locação por período, etc.), a não ser que seja estritamente necessário para o
   Prisma aceitar o update (ex.: não enviar um campo que não existe no schema).

---

## Arquivos principais

| Arquivo                                       | Uso                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                        | Model `Equipment`: campos Decimal, Boolean, Json, relação com Category, etc.                   |
| `app/api/admin/equipments/[id]/route.ts`      | Handler PUT que monta `updateData` e chama `prisma.equipment.update()`.                        |
| `app/admin/equipamentos/[id]/editar/page.tsx` | Formulário que envia os dados; não precisa ser alterado a menos que a API exija outro formato. |
| `lib/prisma.ts`                               | Cliente Prisma com `PrismaPg` (adapter) + `Pool` do `pg`.                                      |

---

## Dicas úteis

- Com **driver adapter**, às vezes o Prisma é mais rígido com tipos (ex.:
  Decimal, datas, JSON). Vale checar a documentação do Prisma para “Prisma
  Client + Driver Adapters” e para o tipo `EquipmentUpdateInput` /
  `EquipmentUncheckedUpdateInput` gerado no seu projeto.
- Se o problema for apenas a forma do `data`, uma abordagem é construir o objeto
  com tipo explícito (ex.: `Prisma.EquipmentUpdateInput` ou
  `Prisma.EquipmentUncheckedUpdateInput`) e atribuir só os campos que o tipo
  permite, evitando `Record<string, unknown>`.
- Se o erro mencionar um campo específico na mensagem completa (no log do
  servidor), use isso como primeiro indício.
- Rodar o servidor com `pnpm dev` e reproduzir o erro; o **stack trace
  completo** no terminal do servidor costuma conter a mensagem completa do
  Prisma (incluindo qual argumento ou campo está inválido).

---

## Critério de sucesso

- Ao salvar o formulário de edição de um equipamento (com ou sem alterações nos
  novos campos de “desativar locação por período”), a requisição
  `PUT /api/admin/equipments/[id]` retorna **200** e o equipamento é atualizado
  no banco sem erro.
- Não surge novo erro de tipo ou de runtime no servidor ou no cliente por causa
  da alteração feita na API.
