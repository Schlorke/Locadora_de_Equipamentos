# Resumo detalhado: Frete não refletido no valor final do orçamento

**Objetivo deste documento:** Permitir que outra IA ou desenvolvedor corrija de
forma completa o problema do frete não aparecer no valor final em todos os
pontos da aplicação.

---

## 1. Descrição do problema

Quando o administrador informa ou altera o **Valor do Frete** (ex.: R$ 50,00 ou
R$ 60,00) em um orçamento, esse valor **não está sendo refletido de forma
consistente** no **valor final** exibido ao usuário. Em alguns lugares a tela
mostra o total antigo (ex.: R$ 2.288,00) e em outros o total correto com frete
(ex.: R$ 2.348,00 ou R$ 2.257,00, conforme o caso).

O usuário espera: **em toda a aplicação**, o valor exibido como “total” ou
“valor final” do orçamento deve ser **sempre** o total que **inclui frete** (e
ajustes, quando houver), ou seja: `finalTotal ?? originalTotal ?? totalPrice`,
onde esses campos já vêm preenchidos corretamente do backend.

---

## 2. Modelo de dados (backend)

- **Quote** (Prisma) tem, entre outros:
  - `total` – total geral do orçamento (deveria ser equipamentos + frete).
  - `originalTotal` – valor “original” (também deve incluir frete quando não há
    valor final editado).
  - `finalTotal` – valor final editado pelo admin (com justificativa); quando
    existe, é o que vale para exibição.
  - `deliveryFee` – valor do frete (entrega).
  - `pickupFee` – valor da retirada.

- **Regra de negócio desejada:**  
  Sempre que `deliveryFee` ou `pickupFee` for alterado (especialmente pelo
  admin), o sistema deve:
  1. Recalcular `total` = soma dos itens + `deliveryFee` + `pickupFee`.
  2. Atualizar `originalTotal` (e, se existir, `finalTotal`) com esse mesmo
     total, para que **todos os valores exibidos** em qualquer tela usem o total
     que já inclui frete.

---

## 3. O que já foi feito (e pode estar incompleto ou incorreto)

### 3.1 Backend – PATCH admin ao alterar frete

- **Arquivo:** `app/api/admin/quotes/[id]/route.ts`
- **Alteração:** Foi adicionado um bloco que, quando o body do PATCH contém
  `deliveryFee` ou `pickupFee`, recalcula:
  - `total` = soma dos itens + `deliveryFee` + `pickupFee`
  - `originalTotal` = mesmo valor
  - `finalTotal` = mesmo valor (quando já existia)
- **Possíveis problemas:** Verificar se esse bloco está realmente sendo
  executado (ex.: se a condição `'deliveryFee' in body` está correta para o
  payload que o front envia), se os tipos (Decimal vs number) estão compatíveis
  com o Prisma e se não há outro trecho do PATCH que sobrescreva
  `total`/`originalTotal`/`finalTotal` depois.

### 3.2 Frontend – Exibição do “valor final”

Foram alterados vários pontos para usar “total efetivo”
(`finalTotal ?? originalTotal ?? totalPrice`) em vez de só `totalPrice` ou
`boletoPayment.amount`:

- **Admin – orçamentos**
  - Card do Boleto (“Valor pendente”): `app/admin/orcamentos/page.tsx` – passou
    a usar `finalTotal ?? originalTotal ?? totalPrice ?? boletoPayment.amount`.
  - Normalização do quote vindo do GET único: em `normalizeQuote` foi garantido
    que `totalPrice` seja preenchido a partir de `total` quando o quote vem de
    `GET /api/admin/quotes/[id]` (que retorna `total`, não `totalPrice`).
- **Área do cliente**
  - Dashboard – card de orçamento pendente: `app/area-cliente/page.tsx` – valor
    em verde usando `finalTotal ?? originalTotal ?? totalPrice`.
  - Histórico – listagem de orçamentos: `app/area-cliente/historico/page.tsx` –
    “Valor Total” do card usando `finalTotal ?? originalTotal ?? totalPrice`.

**Possíveis problemas:**

- Outros lugares ainda podem estar usando apenas `quote.totalPrice` ou
  `payment.amount` (ex.: feed de atividades, detalhe do orçamento, emails, PDF).
- O **GET único** do quote (`GET /api/admin/quotes/[id]`) retorna o objeto “cru”
  do Prisma (com `total`, `originalTotal`, `finalTotal`); o frontend da listagem
  admin usa um formato transformado (com `totalPrice`). Qualquer componente que
  use o quote vindo do GET único precisa garantir que o “total efetivo” seja
  derivado de `total` ou de `originalTotal`/`finalTotal`, não apenas de
  `totalPrice` (que pode não existir nessa resposta).
- **Atividades** na dashboard do cliente: o valor exibido pode vir de
  `activity.metadata.amount`, gravado no momento da criação da atividade. Se o
  orçamento for atualizado (ex.: frete adicionado) depois, as atividades antigas
  continuam com o valor antigo; pode ser necessário buscar o total atual do
  quote quando a atividade for de orçamento, ou atualizar atividades ao alterar
  o quote.
- **Boleto:** O valor do boleto (`payment.amount`) é gerado em outro fluxo. Se o
  admin só alterar o frete e não regenerar o boleto, `payment.amount` pode
  continuar com o valor antigo. A exibição foi alterada para priorizar o total
  do quote, mas o boleto em si (arquivo/valor a pagar) pode ainda estar
  desatualizado até haver regeneração.

---

## 4. Pontos que precisam ser verificados e corrigidos

### 4.1 Backend

1. **PATCH `app/api/admin/quotes/[id]/route.ts`**
   - Confirmar que, ao receber `deliveryFee` e/ou `pickupFee` no body, o
     recálculo de `total`, `originalTotal` e `finalTotal` está correto e que
     esses valores são realmente persistidos (não são sobrescritos depois no
     mesmo request).
   - Confirmar que o frontend admin envia exatamente `deliveryFee` (e não outro
     nome, ex.: `delivery_fee`) ao salvar “Editar entrega”.
   - Verificar se há outros endpoints que alteram `deliveryFee`/`pickupFee` sem
     recalcular totais (ex.: algum PATCH parcial).

2. **Criação do orçamento (POST)**
   - `app/api/quotes/route.ts`: na criação com entrega, o frete é calculado e
     somado a `totalAmount` e salvo em `total` e `originalTotal`. Verificar se
     em todos os fluxos (ex.: com/sem CEP, com/sem erro no cálculo de frete) o
     total fica consistente e se o cliente nunca envia um valor de frete já
     escolhido que seja ignorado.

3. **Respostas das APIs**
   - **GET `/api/quotes`** (lista do cliente): retorna `totalPrice`,
     `originalTotal`, `finalTotal` (transformados a partir de `quote.total`,
     etc.). Garantir que esses campos refletem o que está no banco após qualquer
     atualização de frete.
   - **GET `/api/admin/quotes/[id]`**: retorna o quote “cru” (incluindo `total`,
     `originalTotal`, `finalTotal`). Quem consome essa resposta no frontend deve
     tratar `total` como total efetivo quando `totalPrice` não existir.
   - **GET `/api/admin/quotes`** (listagem admin): já usa
     `totalPrice: Number(quote.total)`, etc. Garantir que está usando os mesmos
     campos que foram persistidos no PATCH.

### 4.2 Frontend – todos os lugares que exibem “valor total” ou “valor final” do orçamento

Garantir que **todos** usem o total efetivo:
**`quote.finalTotal ?? quote.originalTotal ?? quote.totalPrice ?? 0`** (e, no
admin, onde fizer sentido, fallback para `boletoPayment.amount` apenas se
necessário).

Locais conhecidos a auditar:

| Onde                                           | Arquivo                                    | O que verificar                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin – lista de orçamentos (tabela)           | `app/admin/orcamentos/page.tsx`            | Coluna de valor: deve usar total efetivo (pode ser `totalPrice` se a API já retornar atualizado).                                                                                                                         |
| Admin – painel lateral ao selecionar orçamento | `app/admin/orcamentos/page.tsx`            | “Valor Original”, “Valor Final Editado”, card do Boleto (“Valor pendente”): todos com total efetivo.                                                                                                                      |
| Admin – modal/detalhe de orçamento             | `app/admin/orcamentos/page.tsx`            | Qualquer exibição de total: total efetivo.                                                                                                                                                                                |
| Área do cliente – dashboard                    | `app/area-cliente/page.tsx`                | Card de orçamento pendente: já alterado para total efetivo; confirmar que a API retorna dados atualizados.                                                                                                                |
| Área do cliente – histórico (lista)            | `app/area-cliente/historico/page.tsx`      | “Valor Total” no card: já alterado para total efetivo.                                                                                                                                                                    |
| Área do cliente – detalhe do orçamento         | `app/area-cliente/historico/[id]/page.tsx` | Todas as exibições de total (valor original, valor reajustado, valor do boleto, etc.): usar total efetivo e, onde for “valor do boleto”, deixar claro se é o valor do quote ou o valor do pagamento.                      |
| Feed de atividades (dashboard cliente)         | `app/area-cliente/page.tsx`                | Se o valor vier de `activity.metadata.amount`, pode estar desatualizado; avaliar buscar total atual do quote por `activity.metadata.quoteId` ou similar, ou documentar que atividades mostram valor no momento do evento. |

### 4.3 Fluxo “Editar entrega” no admin

- **Arquivo:** `app/admin/orcamentos/page.tsx`
- **Função:** `saveDelivery` (ou equivalente) que monta o body e chama
  `PATCH /api/admin/quotes/${selectedQuote.id}`.
- **Verificar:** O body enviado contém exatamente `deliveryFee` (número ou
  string numérica) e, quando aplicável, `deliveryType` e `deliveryAddress`.
  Confirmar no DevTools (Network) o payload real do PATCH ao salvar o frete.
- **Após o PATCH:** O frontend chama `updateQuoteInState(selectedQuote.id)`, que
  faz **GET** em `/api/admin/quotes/${id}` e atualiza o estado. O objeto
  retornado pelo GET tem `total`, `originalTotal`, `finalTotal`; a função
  `normalizeQuote` deve preencher `totalPrice` a partir de `total` para que
  qualquer componente que leia `selectedQuote.totalPrice` ou
  `selectedQuote.originalTotal`/`finalTotal` veja o valor atualizado.

### 4.4 Boleto e pagamentos

- Ao alterar apenas o frete, o **valor do boleto** (registro de pagamento) pode
  não ser atualizado automaticamente. Avaliar:
  - Se existe fluxo de “regenerar boleto” ao alterar o total do orçamento e se
    deve ser chamado quando o frete for salvo.
  - Ou se a UI deve sempre mostrar o “total do orçamento” (total efetivo) e, em
    outro lugar, o “valor do boleto” (quando diferente), com aviso para o
    cliente.

---

## 5. Como validar a correção de ponta a ponta

1. **Criar ou abrir um orçamento** com itens (ex.: total de itens R$ 2.228,00).
2. **No admin:** Abrir o orçamento → “Editar entrega” → informar **Valor do
   frete (R$): 60** → Salvar.
3. **Verificar no admin:**
   - Valor exibido no painel lateral (valor original / valor final) = R$
     2.288,00 (2.228 + 60).
   - Valor na tabela de orçamentos = R$ 2.288,00.
   - Valor no card do Boleto (“Valor pendente”) = R$ 2.288,00.
4. **Fazer logout e entrar como cliente** (dono do orçamento):
   - Dashboard: card do orçamento pendente deve mostrar R$ 2.288,00.
   - Histórico (lista): “Valor Total” do mesmo orçamento = R$ 2.288,00.
   - Detalhe do orçamento (`/area-cliente/historico/quote_xxx`): todos os totais
     = R$ 2.288,00.
5. **Opcional:** Alterar o frete de 60 para 50; salvar; repetir as verificações
   acima com R$ 2.278,00.

Se em **qualquer** um desses pontos o valor exibido for o total **sem** frete
(ex.: R$ 2.228,00), a correção ainda está incompleta nesse lugar ou no fluxo de
dados que o alimenta.

---

## 6. Arquivos principais envolvidos

- `app/api/admin/quotes/[id]/route.ts` – PATCH que deve recalcular totais ao
  alterar frete.
- `app/api/quotes/route.ts` – GET (formato da lista do cliente) e POST (criação
  com frete).
- `app/admin/orcamentos/page.tsx` – UI admin: lista, painel, modal,
  `saveDelivery`, `normalizeQuote`.
- `app/area-cliente/page.tsx` – Dashboard cliente: cards de orçamento e
  atividades.
- `app/area-cliente/historico/page.tsx` – Lista de orçamentos no histórico.
- `app/area-cliente/historico/[id]/page.tsx` – Detalhe do orçamento/locação
  (várias exibições de total).

---

## 7. Resumo em uma frase

**Problema:** O valor do frete informado no admin não é refletido de forma
consistente no “valor final” em toda a aplicação.  
**Solução desejada:** (1) Backend: ao alterar `deliveryFee`/`pickupFee`,
recalcular e persistir `total`, `originalTotal` e `finalTotal`; (2) Frontend: em
**todos** os pontos que exibem “total” ou “valor final” do orçamento, usar
**sempre** o total efetivo `finalTotal ?? originalTotal ?? totalPrice` (e
garantir que as APIs e a normalização do GET único forneçam esses campos
corretamente).

Este documento pode ser usado como briefing completo para delegar a correção a
outra IA ou desenvolvedor.
