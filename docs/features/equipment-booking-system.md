# 📅 Sistema de Agendamento de Equipamentos - Plano de Implementação

> **Plano antigo de Janeiro2025**: `components/equipment-date-range-picker.tsx`,
> `components/availability-calendar.tsx` e
> `app/api/equipamentos/[id]/availability*` são nomes propostos nunca
> instalados, não caminhos atuais. A raiz antiga foi retirada em F. A
> disponibilidade implementada tem dono em
> `packages/backend/src/modules/rentals/availability.ts`; não expõe os dois
> endpoints propostos abaixo (ver `docs/features/quote-stock-blocking.md`).

> **Status**: 📋 Planejamento | **Prioridade**: 🔴 Alta | **Data**: Janeiro 2025

## 📋 Sumário Executivo

Este documento apresenta um plano completo para implementar um sistema de
agendamento de equipamentos na página de visualização de equipamentos da GB
Locações. O sistema permitirá que clientes selecionem datas específicas de
início e fim da locação através de um calendário interativo, similar ao Notion,
proporcionando controle total sobre períodos de locação e melhor gestão para o
administrador.

---

## 🎯 Objetivos

### Para o Cliente

- ✅ Selecionar datas específicas de início e fim da locação
- ✅ Visualizar disponibilidade em tempo real
- ✅ Calcular preço automaticamente baseado nas datas selecionadas
- ✅ Experiência intuitiva e moderna (inspirada no Notion)

### Para o Administrador

- ✅ Controle total sobre disponibilidade de equipamentos
- ✅ Visualização de conflitos de agendamento
- ✅ Relatórios de ocupação e utilização
- ✅ Gestão de períodos bloqueados (manutenção, etc.)

---

## 🏗️ Arquitetura do Sistema

### 1. **Componentes Frontend**

#### 1.1. `EquipmentDateRangePicker` (Novo Componente)

**Localização proposta pelo plano antigo (não instalada)**:
`components/equipment-date-range-picker.tsx`

**Funcionalidades**:

- Calendário interativo com seleção de range (início e fim)
- Exibição de disponibilidade em tempo real
- Integração com `Popover` (estilo Notion)
- Validação de datas (não permitir passado, mínimo de dias, etc.)
- Feedback visual de conflitos

**Props**:

```typescript
interface EquipmentDateRangePickerProps {
  equipmentId: string
  onDateRangeChange: (range: { start: Date; end: Date; days: number }) => void
  initialStartDate?: Date
  initialEndDate?: Date
  minDays?: number
  maxDays?: number
  disabledDates?: Date[] // Para manutenção, bloqueios, etc.
  className?: string
}
```

#### 1.2. `AvailabilityCalendar` (Novo Componente)

**Localização proposta pelo plano antigo (não instalada)**:
`components/availability-calendar.tsx`

**Funcionalidades**:

- Visualização de disponibilidade por dia
- Indicadores visuais:
  - 🟢 Disponível
  - 🟡 Poucos disponíveis (quase esgotado)
  - 🔴 Indisponível
  - ⚪ Bloqueado (manutenção)
- Tooltips com informações detalhadas

#### 1.3. Modificação: `SmartEquipmentPricing`

**Localização**:
`packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.web.tsx`

**Mudanças**:

- Integrar `EquipmentDateRangePicker` antes do seletor de período
- Calcular preço baseado em datas reais (não apenas períodos)
- Mostrar resumo: "X dias de locação (DD/MM/YYYY a DD/MM/YYYY)"
- Otimizar contagem de dias uteis sem iterar datas, mantendo as regras atuais

---

### 2. **Backend/API**

#### 2.1. API proposta, não instalada: `/api/equipamentos/[id]/availability`

**Localização proposta pelo plano antigo (não instalada)**:
`app/api/equipamentos/[id]/availability/route.ts`

**Endpoint**:
`GET /api/equipamentos/[id]/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**Funcionalidades**:

- Verificar disponibilidade de equipamento em um período
- Considerar:
  - `maxStock` do equipamento
  - Reservas ativas (`Quote` com status `APPROVED` ou `PENDING`)
  - Locações ativas (`rentals` com status `ACTIVE`)
  - Períodos bloqueados (futuro: tabela `EquipmentBlockedPeriod`)

**Resposta**:

```typescript
{
  available: boolean
  availableQuantity: number
  requestedQuantity: number
  conflicts: Array<{
    startDate: string
    endDate: string
    reason: "BOOKED" | "MAINTENANCE" | "BLOCKED"
  }>
}
```

#### 2.2. API proposta, não instalada: `/api/equipamentos/[id]/availability-calendar`

**Localização proposta pelo plano antigo (não instalada)**:
`app/api/equipamentos/[id]/availability-calendar/route.ts`

**Endpoint**: `GET /api/equipamentos/[id]/availability-calendar?month=YYYY-MM`

**Funcionalidades**:

- Retornar disponibilidade de um mês inteiro
- Otimizado para exibição no calendário
- Cache de 5 minutos para performance

**Resposta**:

```typescript
{
  month: string // YYYY-MM
  availability: Array<{
    date: string // YYYY-MM-DD
    available: boolean
    availableQuantity: number
    maxStock: number
    isBlocked: boolean
    blockedReason?: string
  }>
}
```

#### 2.3. Modificação: `/api/quotes` (POST)

**Mudanças**:

- Aceitar `startDate` e `endDate` no body
- Validar disponibilidade antes de criar orçamento
- Retornar erro se não houver disponibilidade

---

### 3. **Banco de Dados**

#### 3.1. Schema Existente (Já Implementado)

O modelo `Quote` já possui:

- `startDate: DateTime?`
- `endDate: DateTime?`

✅ **Não é necessário criar novas tabelas inicialmente**

#### 3.2. Futuro: Tabela `EquipmentBlockedPeriod` (Fase 2)

Para bloqueios de manutenção e períodos especiais:

```prisma
model EquipmentBlockedPeriod {
  id          String   @id @default(cuid())
  equipmentId String
  startDate   DateTime
  endDate     DateTime
  reason      String   // "MAINTENANCE" | "HOLIDAY" | "CUSTOM"
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  equipment   Equipment @relation(fields: [equipmentId], references: [id])

  @@index([equipmentId])
  @@index([startDate, endDate])
  @@map("equipment_blocked_periods")
}
```

**Nota**: Esta tabela será implementada na Fase 2, após validação do sistema
básico.

---

## 🎨 Design e UX

### 1. **Fluxo do Usuário**

```
1. Cliente acessa página do equipamento
   ↓
2. Visualiza seletor de período (Diário, Semanal, etc.)
   ↓
3. Clica em "Selecionar Datas" (botão novo)
   ↓
4. Popover abre com calendário (estilo Notion)
   ↓
5. Cliente seleciona data de início
   ↓
6. Cliente seleciona data de fim
   ↓
7. Sistema valida disponibilidade em tempo real
   ↓
8. Mostra feedback visual (disponível/indisponível)
   ↓
9. Calcula preço automaticamente
   ↓
10. Cliente confirma e clica em "Solicitar Orçamento"
```

### 2. **Interface Visual**

#### 2.1. Botão "Selecionar Datas"

**Localização**: Dentro de `SmartEquipmentPricing`, acima do seletor de período

**Design**:

- Botão outline com ícone de calendário
- Texto: "Selecionar Datas" ou "Personalizar Período"
- Quando datas selecionadas: mostrar range (ex: "08/12/2025 - 15/12/2025")

#### 2.2. Popover do Calendário

**Estilo**: Inspirado no Notion

**Características**:

- Popover com `z-index` alto (usar `--layer-popover`)
- Calendário com `react-day-picker` (já existe no projeto)
- Seleção de range visual
- Indicadores de disponibilidade por dia
- Botões de ação rápida:
  - "Hoje"
  - "+7 dias"
  - "+15 dias"
  - "+30 dias"
- Botão "Confirmar" e "Limpar"

#### 2.3. Feedback Visual

**Cores**:

- 🟢 Verde: Disponível
- 🟡 Amarelo: Poucos disponíveis (< 30% do estoque)
- 🔴 Vermelho: Indisponível
- ⚪ Cinza: Bloqueado/Manutenção

**Tooltips**:

- Hover em cada dia mostra: "X de Y disponíveis" ou "Indisponível - motivo"

---

## 🔧 Etapas técnicas propostas em Janeiro2025 (não checklist de código instalado)

### Fase 1: Fundação (Semana 1)

#### 1.1. Criar API de Disponibilidade

- [ ] Reavaliar o endpoint de disponibilidade do plano antigo, então chamado
      `app/api/equipamentos/[id]/availability/route.ts` (nunca instalado). Uma
      eventual API exige adapter no host API atual, reutilizando o serviço
      tenant; não criar esse caminho na raiz retirada.
- [ ] Implementar lógica de verificação de conflitos
- [ ] Testar com diferentes cenários

#### 1.2. Criar API de Calendário

- [ ] Reavaliar o calendário do plano antigo, então chamado
      `app/api/equipamentos/[id]/availability-calendar/route.ts` (nunca
      instalado). DTO, cache e guard desse novo endpoint ainda exigem
      decisão/validação própria.
- [ ] Implementar cache (5 minutos)
- [ ] Otimizar queries para performance

#### 1.3. Criar Componente `EquipmentDateRangePicker`

- [ ] Criar componente base com `react-day-picker`
- [ ] Integrar com `Popover`
- [ ] Implementar seleção de range
- [ ] Adicionar validações básicas

### Fase 2: Integração (Semana 2)

#### 2.1. Integrar com `SmartEquipmentPricing`

- [ ] Adicionar botão "Selecionar Datas"
- [ ] Integrar `EquipmentDateRangePicker`
- [ ] Atualizar cálculo de preço baseado em datas reais
- [ ] Mostrar resumo de datas selecionadas

#### 2.2. Criar Componente `AvailabilityCalendar`

- [ ] Criar visualização de disponibilidade
- [ ] Implementar indicadores visuais
- [ ] Adicionar tooltips informativos

#### 2.3. Atualizar API de Quotes

- [ ] Aceitar `startDate` e `endDate` no POST
- [ ] Validar disponibilidade antes de criar
- [ ] Retornar erros apropriados

### Fase 3: Refinamento (Semana 3)

#### 3.1. Melhorias de UX

- [ ] Adicionar animações suaves
- [ ] Melhorar feedback visual
- [ ] Adicionar loading states
- [ ] Implementar error handling

#### 3.2. Testes

- [ ] Testes unitários dos componentes
- [ ] Testes de integração das APIs
- [ ] Testes E2E com Playwright
- [ ] Testes de acessibilidade

### Fase 4: Admin Dashboard (Fase Futura)

#### 4.1. Visualização de Agendamentos

- [ ] Calendário de agendamentos no admin
- [ ] Filtros por equipamento, data, status
- [ ] Visualização de conflitos

#### 4.2. Gestão de Bloqueios

- [ ] Criar tabela `EquipmentBlockedPeriod`
- [ ] Interface para bloquear períodos
- [ ] Notificações de conflitos

---

## 📊 Lógica de Disponibilidade

### Regras de Negócio

1. **Disponibilidade Base**:
   - Equipamento deve ter `available = true`
   - `maxStock` define quantidade máxima

2. **Verificação de Conflitos**:

   ```typescript
   // Pseudocódigo
   function checkAvailability(
     equipmentId,
     startDate,
     endDate,
     requestedQuantity
   ) {
     const maxStock = equipment.maxStock

     // Buscar todas as reservas/locações ativas no período
     const activeBookings = [
       ...quotes.filter(
         (q) =>
           q.status === "APPROVED" ||
           (q.status === "PENDING" &&
             overlaps(q.startDate, q.endDate, startDate, endDate))
       ),
       ...rentals.filter(
         (r) =>
           r.status === "ACTIVE" &&
           overlaps(r.startDate, r.endDate, startDate, endDate)
       )
     ]

     // Calcular quantidade já reservada
     const bookedQuantity = activeBookings.reduce((sum, booking) => {
       return (
         sum +
         booking.items
           .filter((item) => item.equipmentId === equipmentId)
           .reduce((itemSum, item) => itemSum + item.quantity, 0)
       )
     }, 0)

     // Verificar disponibilidade
     const availableQuantity = maxStock - bookedQuantity

     return {
       available: availableQuantity >= requestedQuantity,
       availableQuantity,
       requestedQuantity
     }
   }
   ```

3. **Períodos Bloqueados** (Futuro):
   - Verificar tabela `EquipmentBlockedPeriod`
   - Retornar `isBlocked: true` se houver bloqueio

---

## 🎯 Exemplo de Uso

### Frontend

```tsx
// Em SmartEquipmentPricing
const [dateRange, setDateRange] = useState<{
  start: Date | null
  end: Date | null
  days: number
} | null>(null)

// Calcular preço baseado em datas reais
const calculatePriceFromDates = (start: Date, end: Date) => {
  const days = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )
  // Aplicar lógica de desconto baseada em dias
  // ...
}

// Renderizar
;<EquipmentDateRangePicker
  equipmentId={equipmentId}
  onDateRangeChange={(range) => {
    setDateRange(range)
    const price = calculatePriceFromDates(range.start, range.end)
    setFinalPrice(price)
  }}
  minDays={1}
  maxDays={3650}
/>
```

### Backend — exemplo do plano antigo, não código instalado

Este exemplo de Janeiro2025 não resolve TenantContext/RLS nem representa a
implementação canônica; não deve ser copiado para o host API. Preserva-se como
registro da proposta, não como receita operacional após F.

```typescript
// Caminho do plano antigo (nunca instalado): app/api/equipamentos/[id]/availability/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const quantity = parseInt(searchParams.get("quantity") || "1")

  // Validar datas
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate e endDate são obrigatórios" },
      { status: 400 }
    )
  }

  const availability = await checkEquipmentAvailability(
    id,
    new Date(startDate),
    new Date(endDate),
    quantity
  )

  return NextResponse.json(availability)
}
```

---

## Disponibilidade já implementada no backend

`createRentalAvailability` em
`packages/backend/src/modules/rentals/availability.ts` recebe
`withTenantTransaction`. Todas as consultas restringem equipamento, itens e
locações ao tenant; contexto ausente não escolhe uma locadora padrão.
`calculateEquipmentAvailability`/`assertRentalItemsAvailability` usam o pico de
quantidade reservada em intervalos (`peakReservedQuantity` do domínio), não uma
soma indiscriminada de todas as reservas. Consideram os estados de locação
bloqueantes, manutenção e a exclusão explícita da própria locação quando
cabível.

`calculateEquipmentCalendarAvailability` já calcula o mapa diário interno e
estoque; sua existência não instala o endpoint público ou o DTO `conflicts`/
`blockedReason` proposto acima. Uma nova exposição deve reusar essa regra, com
principal/tenant confiáveis, sem criar uma query paralela ou enfraquecer os
oráculos atuais de estoque/preço. Nenhuma nova UI, rota ou cache foi validado
por esta revisão documental.

## 🔒 Segurança e Validação pretendidas pelo plano antigo

### Validações Frontend

- ✅ Não permitir selecionar datas no passado
- ✅ Dropdown de mes/ano deve iniciar no mes/ano vigente e, ao trocar o ano,
  abrir janeiro (ou o primeiro mes disponivel)
- ✅ Validar mínimo de dias (ex: 1 dia)
- ✅ Validar máximo de periodo (ex: 10 anos)
- ✅ Validar que data fim > data início
- ✅ Mostrar erro se não houver disponibilidade

### Validações Backend

- ✅ Verificar se equipamento existe
- ✅ Verificar se equipamento está disponível
- ✅ Validar formato de datas
- ✅ Validar quantidade solicitada
- ✅ Rate limiting (prevenir abuse)

---

## 📈 Métricas e Monitoramento

### Métricas a Rastrear

- Taxa de conversão (seleção de datas → orçamento)
- Períodos mais solicitados
- Equipamentos mais alugados
- Conflitos de disponibilidade
- Tempo médio de locação

### Logs

- Todas as verificações de disponibilidade
- Conflitos detectados
- Erros de validação

---

## 🚀 Roadmap Futuro

### Fase 2: Bloqueios e Manutenção

- [ ] Tabela `EquipmentBlockedPeriod`
- [ ] Interface admin para bloquear períodos
- [ ] Notificações automáticas de conflitos

### Fase 3: Otimizações Avançadas

- [ ] Sugestões inteligentes de datas alternativas
- [ ] Previsão de disponibilidade (ML)
- [ ] Reserva temporária (hold) por X minutos

### Fase 4: Integrações

- [ ] Sincronização com Google Calendar
- [ ] Notificações SMS
- [ ] Integração com sistemas de pagamento

---

## 📚 Referências e Inspirações

- **Notion Date Picker**: Interface moderna e intuitiva
- **Airbnb Calendar**: Visualização de disponibilidade
- **Booking.com**: Sistema de reservas robusto
- **react-day-picker**: Biblioteca já utilizada no projeto

---

## ✅ Checklist de Implementação

### Backend

- [ ] API `/api/equipamentos/[id]/availability`
- [ ] API `/api/equipamentos/[id]/availability-calendar`
- [ ] Atualizar `/api/quotes` para aceitar datas
- [ ] Implementar lógica de verificação de conflitos
- [ ] Adicionar cache para performance
- [ ] Testes unitários das APIs

### Frontend

- [ ] Componente `EquipmentDateRangePicker`
- [ ] Componente `AvailabilityCalendar`
- [ ] Integração com `SmartEquipmentPricing`
- [ ] Atualizar cálculo de preço baseado em datas
- [ ] Feedback visual de disponibilidade
- [ ] Validações de formulário
- [ ] Testes de componentes

### UX/UI

- [ ] Design do popover (estilo Notion)
- [ ] Indicadores visuais de disponibilidade
- [ ] Animações suaves
- [ ] Tooltips informativos
- [ ] Estados de loading/error
- [ ] Responsividade mobile

### Documentação

- [ ] Atualizar `CHANGELOG.md`
- [ ] Documentar APIs no OpenAPI
- [ ] Criar stories no Storybook
- [ ] Guia de uso para administradores

---

## 🎓 Conclusão

Este sistema de agendamento transformará a experiência de locação da GB
Locações, proporcionando:

1. **Para Clientes**: Controle total sobre períodos de locação com interface
   moderna
2. **Para Administradores**: Visibilidade completa de disponibilidade e
   agendamentos
3. **Para o Negócio**: Redução de conflitos, melhor gestão de estoque, aumento
   de conversão

A implementação será feita em fases, começando com funcionalidades essenciais e
evoluindo com base no feedback dos usuários.

---

**Última atualização**: 2026-01-04 **Autor**: Sistema de IA (baseado em pesquisa
e análise do código) **Status**: 📋 Aguardando aprovação para implementação
