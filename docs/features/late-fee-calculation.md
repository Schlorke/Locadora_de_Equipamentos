# Sistema de Cálculo de Multa por Atraso

> **⚠️ CRÍTICO**: Sistema que calcula automaticamente multa por atraso, mas
> requer aprovação do admin para ser aplicada. Tudo é discriminado para cliente
> e admin.

## 1. Propósito

O sistema calcula automaticamente o valor da multa por atraso baseado na data de
término do orçamento e data atual, mas requer aprovação explícita do admin para
ser aplicada ao orçamento.

## 2. Lógica de Funcionamento

### 2.1. Fluxo de Cálculo e Aprovação

1. **Sistema detecta atraso**: Data atual > data de término do orçamento
2. **Admin clica em "Calcular Multa"** no modal de detalhes
3. **Sistema calcula**:
   - Dias de atraso
   - Valor da multa (baseado em configuração)
4. **Sistema exibe**:
   - Valor calculado
   - Dias de atraso
   - Método de cálculo usado
5. **Admin aprova ou rejeita**:
   - Se aprovar: Multa é adicionada ao valor final
   - Se rejeitar: Multa não é aplicada
6. **Após a aprovação, o caso de atualização salva** (a simulação não grava):
   - `lateFee`: Valor da multa calculada
   - `lateFeeApproved`: Boolean (se foi aprovada)
   - `lateFeeApprovedAt`: Data de aprovação
   - `lateFeeApprovedBy`: ID do admin que aprovou
7. **Cliente visualiza**:
   - Multa calculada (se houver)
   - Status de aprovação
   - Valor final com multa (se aprovada)

### 2.2. Configuração de Cálculo

A simulação administrativa usa `DEFAULT_LATE_FEE_CONFIG` quando o corpo não traz
`config`; o job de cálculo em lote usa o mesmo padrão. O utilitário puro aceita
outra configuração fornecida pelo chamador:

```typescript
{
  dailyRate: 0.02,      // 2% ao dia
  maxDays: 30,          // Máximo de 30 dias para calcular
  minAmount: 50,        // Mínimo de R$ 50,00
  maxAmount: 5000,      // Máximo de R$ 5.000,00
}
```

**Métodos de Cálculo**:

- **Taxa Diária**: `valorOriginal × taxaDiária × diasAtraso`
- **Valor Fixo**: Valor fixo configurado

`daysLate` usa o teto da diferença em dias de 24 horas e nunca fica negativo.
Sem atraso retorna zero antes de aplicar mínimo/máximo. `maxDays` limita os dias
usados no valor, não altera o número de dias informado. O valor é Decimal,
arredondado em centavos por ROUND_HALF_UP. Configuração customizada não herda
silenciosamente todo o padrão: os defaults do utilitário incluem taxa 2% e
mínimo zero, enquanto o objeto padrão acima fixa min50/max5000/maxDays30.

### 2.3. Regras de Negócio

- **Cálculo automático**: Sistema calcula quando solicitado
- **Aprovação obrigatória**: Admin DEVE aprovar para aplicar multa
- **Tudo discriminado**: Cliente e admin veem todos os detalhes
- **Integração com ajuste de valor**: Multa aprovada adiciona ao valor final

## 3. Arquitetura e Dependências

### 3.1. Schema Prisma

```prisma
model Quote {
  lateFee             Decimal?          // Valor da multa calculada
  lateFeeApproved     Boolean?          @default(false) // Se admin aprovou
  lateFeeApprovedAt   DateTime?         // Data de aprovação
  lateFeeApprovedBy   String?           // ID do admin que aprovou
}
```

### 3.2. API Endpoints

- **POST `/api/admin/quotes/[id]/calculate-late-fee`**: simula sem persistir;
  exige principal da locadora e QUOTES/READ. Schema em
  `packages/contracts/src/quotations.ts` aceita `currentDate` ISO opcional e
  `config` finita/não negativa, com minAmount ≤ maxAmount quando ambos são
  informados. Sem orçamento ou sem data final, recusa antes de calcular.
- **PATCH `/api/admin/quotes/[id]`**: aprova/revoga com
  `{ lateFee: number, lateFeeApproved: boolean }`; o adapter preserva seu guarda
  ADMIN/OPERATOR do vínculo e a atualização no backend mantém tenant, histórico,
  trava e obrigação única. Reaprovar não duplica a multa; trocar substitui e
  revogar retira o acréscimo.
- **GET `/api/cron/late-fees`**: composição de job; considera APPROVED ou
  COMPLETED vencidos e não sobrescreve multas aprovadas. Só atualiza lateFee; a
  aprovação continua manual. A existência da rota não habilita scheduler.

### 3.3. Utilitários

- `packages/domain/src/orcamento/multa.ts`: `calculateLateFee`, tipos e padrão,
  pelo contrato `@gb-locacoes/domain/orcamento`.
- `packages/backend/src/modules/quotations/administration.ts`: consulta por
  locadora e simulação `calculateQuoteLateFee`.
- `packages/backend/src/modules/quotations/late-fees.ts`: cálculo em lote dentro
  de `withTenantTransaction`.
- `packages/backend/src/modules/quotations/update.ts`: aprovação/revogação e
  recomposição de obrigação em centavos.
- `apps/services/api/src/host/quotations.ts` e os adapters
  `apps/services/api/src/app/api/admin/quotes/[id]/calculate-late-fee/route.ts`,
  `[id]/route.ts` e `api/cron/late-fees/route.ts`: composição HTTP.
- `packages/frontend/src/pages/orcamentos-admin/ui/Multa.web.tsx` e modelos do
  detalhe: apresentação e transporte; o cliente não persiste por Prisma.

## 4. Como Usar

### 4.1. Admin - Calcular e Aprovar Multa

1. Acesse `/admin/orcamentos`
2. Clique em orçamento com data de término passada
3. Clique em "Calcular Multa"
4. Sistema exibe valor calculado
5. Clique em "Aprovar e Aplicar Multa" ou "Cancelar"

### 4.2. Cliente - Visualizar Multa

1. Acesse `/area-cliente/historico` na locadora e abra o orçamento próprio
2. Visualize orçamento
3. Veja:
   - Multa calculada (se houver)
   - Status de aprovação
   - Valor final com multa (se aprovada)

## 5. Armadilhas a Evitar

- ❌ **NUNCA** aplique multa sem aprovação do admin
- ❌ **NUNCA** calcule multa para datas futuras
- ❌ **NUNCA** permita aprovação sem valor calculado
- ❌ **NUNCA** perca histórico de aprovação

## 6. Lições Aprendidas

- Aprovação obrigatória garante controle do admin
- Cálculo automático agiliza processo
- Discriminação completa previne disputas

## 7. Histórico de Alterações

| Data       | Descrição                                                                                           | Autor   |
| ---------- | --------------------------------------------------------------------------------------------------- | ------- |
| 2025-01-XX | Implementação inicial; marcador de data preservado como registro histórico, sem inventar dia/commit | Sistema |
