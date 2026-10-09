# Bloqueio de Estoque apos pagamento do orcamento

> **⚠️ CRÍTICO**: Sistema que bloqueia estoque apenas quando orçamento é
> aprovado e pago, não durante criação. Previne vulnerabilidade de bloqueio
> malicioso.

## 1. Proposito

O sistema bloqueia o estoque apenas quando o pagamento e confirmado. Orcamentos
PENDING (inclusive aprovados pelo admin) nao bloqueiam estoque, evitando
bloqueios maliciosos.

## 2. Lógica de Funcionamento

### 2.1. Fluxo de Bloqueio

1. Cliente cria orcamento: sistema nao bloqueia estoque
2. Sistema valida disponibilidade: verifica estoque (sem bloquear)
3. Orcamento criado: status `PENDING`
4. Admin aprova orcamento: registra approvedAt/approvedBy, status permanece
   `PENDING`, boleto pode ser gerado
5. Pagamento confirmado (Asaas): status muda para `APPROVED` e orcamento e
   convertido em locacao
6. Sistema bloqueia estoque: locacao com pagamento aprovado bloqueia o periodo
7. Cliente visualiza: equipamento fica indisponivel no periodo

### 2.2. Regras de Negocio

- **Nao bloqueia durante criacao**: Orcamentos `PENDING` nao bloqueiam estoque
- **Nao bloqueia apenas por aprovacao**: Aprovacao do admin mantem status
  `PENDING`
- **Bloqueia apos pagamento**: Pagamento confirmado libera o bloqueio
- **Validacao server-side**: Sempre valida disponibilidade antes de criar
  orcamento
- **Periodo especifico**: Bloqueia apenas no periodo solicitado pelo cliente

### 2.3. Prevenção de Vulnerabilidade

**Problema**: Se bloqueasse durante criação, usuário mal intencionado poderia:

- Criar múltiplos orçamentos
- Bloquear todos os equipamentos
- Impedir outros clientes de locar

**Solucao**:

- Bloqueio apenas apos pagamento aprovado
- Admin controla aprovacoes e envio do boleto
- Validacao server-side previne overbooking

## 3. Arquitetura e Dependências

### 3.1. Schema Prisma

```prisma
model Quote {
  status              QuoteStatus   @default(PENDING)
  approvedAt          DateTime?
  approvedBy          String?
}

model rentals {
  status              RentalStatus  @default(PENDING)
  quoteId             String?
  quote               Quote?
}
```

### 3.2. Lógica de Disponibilidade

- `packages/backend/src/modules/rentals/availability.ts`
  (`createRentalAvailability`, exposto em `lib/equipment-availability.ts`): lê
  os itens de locação da locadora que cruzam o período (`PENDING`, `ACTIVE`,
  `OVERDUE`, `PENDING_RETURN`), fica só com os que bloqueiam estoque e compara o
  pico reservado com `maxStock`.
- `packages/domain/src/locacao/reserva.ts` (`blocksRentalInventory`): orçamento
  `REJECTED` nunca bloqueia; `ACTIVE`, `OVERDUE` e `PENDING_RETURN` sempre
  bloqueiam; `PENDING` sem orçamento bloqueia; `PENDING` com orçamento bloqueia
  se o pagamento é no fim (`AT_END`) e o orçamento está `APPROVED` ou
  `COMPLETED`, ou se a obrigação está quitada.

### 3.2.1. Manutenção: regra desligada

**Estado atual**: manutenção não bloqueia disponibilidade. O resultado sempre
traz `blockedByMaintenance: false`, e nem o cálculo nem
`isEquipmentAvailableForRental` consultam a tabela `maintenance`. A produção
(`main`, `eb4c0098`) já estava assim: em `lib/equipment-availability.ts` a
checagem ficava comentada com "TODO: Reativar quando o sistema de manutenção
estiver completo".

**Regra de negócio (a que foi desligada)**:

- Com período de locação: manutenção `IN_PROGRESS` do equipamento sempre
  bloqueia; manutenção `SCHEDULED` bloqueia só se `scheduledAt` cai dentro do
  período, bordas inclusive (`scheduledAt >= início` e `<= fim`); agendada fora
  do período não bloqueia.
- Sem período: qualquer manutenção `SCHEDULED` ou `IN_PROGRESS` bloqueia.
- O motivo mostrado ao cliente vinha de `getMaintenanceBlockingInfo`: com
  período, "Manutenção em andamento" ou "Manutenção agendada para <data>
  interfere com o período de locação"; sem período, "Manutenção em andamento" ou
  "Manutenção agendada".

**Implementação recuperável**: `isEquipmentInMaintenance` e
`getMaintenanceBlockingInfo` (já com `TenantContext` e transação, filtrando
`tenantId`) saíram de `lib/maintenance-automation.ts` na faxina da onda 9, sem
chamador; o texto está em `git show 4b02f52f:lib/maintenance-automation.ts`. O
resto do arquivo (início, conclusão e regras preventivas da manutenção)
continua.

**Como religar** (decisão de produto; entrada 228 de
`docs/issues/known-issues.md`):

1. Trazer a consulta para `packages/backend/src/modules/rentals/availability.ts`
   (o `AvailabilityReader` passa a incluir `maintenance`), na mesma transação e
   com o `tenantId` explícito do contexto.
2. No cálculo, manutenção que bloqueia devolve `available: false`,
   `availableQuantity: 0` e `blockedByMaintenance: true`; em
   `isEquipmentAvailableForRental`, o motivo de `getMaintenanceBlockingInfo`.
3. Testes com banco descartável: `IN_PROGRESS` bloqueia; `SCHEDULED` dentro do
   período e na borda bloqueia; fora do período não bloqueia; manutenção de
   outra locadora não bloqueia.

### 3.3. API Endpoints

- **POST `/api/quotes`**: Cria orcamento (nao bloqueia estoque)
- **PATCH `/api/admin/quotes/[id]`**: Aprova orcamento (nao bloqueia)
- **Webhook/cron de boleto**: Confirma pagamento e converte em locacao (bloqueia
  estoque)

## 4. Como Usar

### 4.1. Cliente - Criar Orçamento

1. Cliente seleciona equipamentos e datas
2. Sistema valida disponibilidade (sem bloquear)
3. Cliente envia orçamento
4. Orçamento criado com status `PENDING`
5. Estoque NÃO é bloqueado

### 4.2. Admin - Aprovar Orcamento

1. Admin visualiza orcamento pendente
2. Admin clica em "Aprovar Orcamento"
3. Sistema:
   - Valida disponibilidade novamente
   - Mantem status PENDING ate o pagamento ser confirmado
   - Libera geracao/envio de boleto (se configurado)
4. Quando o pagamento e confirmado:
   - Converte em locacao
   - Bloqueia estoque no periodo solicitado

## 5. Armadilhas a Evitar

- ❌ **NUNCA** bloqueie estoque durante criação de orçamento
- ❌ **NUNCA** permita bloqueio sem validação de disponibilidade
- ❌ **NUNCA** bloqueie estoque para orçamentos rejeitados
- ❌ **NUNCA** perca validação server-side

## 6. Lições Aprendidas

- Bloqueio apenas apos pagamento previne vulnerabilidades
- Validação server-side é essencial
- Admin tem controle total sobre bloqueios

## 7. Histórico de Alterações

| Data       | Descrição                                                                 | Autor   |
| ---------- | ------------------------------------------------------------------------- | ------- |
| 2026-09-30 | Lógica atual (backend/domain) e regra de manutenção desligada documentada | IA      |
| 2026-01-02 | Status PENDING mantido ate pagamento confirmado                           | IA      |
| 2025-01-XX | Implementação inicial                                                     | Sistema |
