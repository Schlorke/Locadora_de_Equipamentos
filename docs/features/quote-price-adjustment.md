# Sistema de Reajuste de Orcamento (Categorizado)

> **Status**: Critical  
> **Last updated**: 2026-02-11

---

## 1. Purpose

Permitir aditivos financeiros rastreaveis no orcamento com justificativa
obrigatoria e categoria de custo, mantendo historico completo e envio ao
cliente.

## 2. Scope

**In scope**

- Registro de reajuste por categoria
- Justificativa obrigatoria
- Atualizacao de totais (`originalTotal`, `finalTotal`)
- Rastreio de envio por e-mail e WhatsApp
- Listagem historica de reajustes por orcamento

**Out of scope**

- Simulador de cenarios tributarios
- Tabela automatica de custos externos (ainda depende de input manual)

## 3. Entry Points

- Frontend admin: `app/admin/orcamentos/page.tsx`
- API:
  - `app/api/admin/quotes/[id]/adjustments/route.ts` (`GET`/`POST`)
- Modelo Prisma:
  - `QuoteAdjustment` em `prisma/schema.prisma`

## 4. Core Flow

1. Admin abre detalhes do orcamento e clica em "Ajustar Valor".
2. Seleciona categoria:
   - `LABOR` (Mao de obra)
   - `TRAVEL` (Deslocamento (Frete))
   - `MAINTENANCE` (Manutencao)
   - `OTHER` (Outro)
3. Informa valor adicional (> 0) e justificativa.
4. API cria `QuoteAdjustment`:
   - **TRAVEL (Deslocamento/Frete)**: o valor **substitui** o frete calculado
     (`deliveryFee`), nao soma. Evita duplicar frete (sistema + manual).
   - **Demais categorias**: soma no total atual.
5. Salva trilha e envia notificacao.
6. Sistema envia notificacao ao cliente:
   - e-mail (obrigatorio quando configurado)
   - WhatsApp (quando integracao ativa e telefone valido)

## 5. Components and Files

- `app/admin/orcamentos/page.tsx`
- `app/api/admin/quotes/[id]/adjustments/route.ts`
- `prisma/schema.prisma` (`QuoteAdjustment`)
- `lib/email-templates.ts`
- `lib/meta-whatsapp.ts`

## 6. Data and State

- `QuoteAdjustment`:
  - `quoteId`, `category`, `amount`, `justification`, `createdBy`
  - `sentEmailAt`, `sentEmailTo`, `sentWhatsappAt`, `sentWhatsappTo`
- `Quote` (compatibilidade historica):
  - `originalTotal`
  - `finalTotal`
  - `priceAdjustmentReason` (concatena historico textual)
  - `priceAdjustedAt`, `priceAdjustedBy`

## 7. Constraints and Edge Cases

- Valor do reajuste deve ser positivo.
- **TRAVEL**: o valor informado substitui o `deliveryFee` no calculo do total
  final; o frete calculado pelo sistema nao e somado ao valor digitado.
- Justificativa e obrigatoria (minimo 3 caracteres).
- Orcamento inexistente retorna erro.
- Falha no WhatsApp nao desfaz o reajuste (operacao principal permanece).
- Envio de e-mail depende de provider/variaveis de ambiente.

## 8. Error Handling

- 400: validacao (categoria, valor, justificativa)
- 401/403: usuario sem permissao (somente `ADMIN`/`OPERATOR`)
- 500: erro de processamento/envio

## 9. Performance and Accessibility

- Operacao principal em transacao unica (criar reajuste + atualizar quote)
- Toasts de feedback para sucesso/erro
- Formulario com labels explicitos e validacao imediata

## 10. Tests and Validation

1. Criar reajuste em cada categoria e validar total final atualizado.
2. Confirmar que `priceAdjustmentReason` agrega o novo bloco de justificativa.
3. Validar registro de `sentEmailAt`/`sentWhatsappAt` quando envio ocorrer.
4. Tentar valor <= 0 e justificativa vazia (deve bloquear).
5. Listar reajustes via `GET /api/admin/quotes/:id/adjustments`.

## 11. Related Docs

- `docs/features/quote-system.md`
- `docs/features/admin-orcamentos-page.md`
- `docs/features/quote-status-tracking.md`
- `docs/issues/known-issues.md`

## 12. Change Log

- 2026-02-21: Dialog de reajuste: containers separados para orcamento (valor
  original), reajustes (itens + botao Adicionar reajuste) e resumo (Total dos
  reajustes, Novo valor final). Bloco orcamento em `bg-gray-50`, bloco resumo em
  `bg-orange-50` para destacar o valor final.
- 2026-02-21: Painel financeiro (`/admin/financeiro`): botao para excluir
  reajuste no historico; dialog de confirmacao; API DELETE passou a aceitar role
  FINANCIAL.
- 2026-02-18: Regra TRAVEL: valor substitui frete calculado, nao soma (corrige
  duplicacao). API POST e DELETE de adjustments atualizados.
- 2026-02-18: Dialog de reajuste: multiplos itens (botao "Adicionar reajuste"),
  cada um com categoria, valor e justificativa; envio em sequencia; Select e
  bloco com borda tracejada (padrao equipamentos).
- 2026-02-11: Evolucao do ajuste simples para reajuste categorizado com trilha
  de envio e endpoint dedicado.

---
