# Sistema de Gerenciamento de Endereços - Documentação Completa

> **Documentação completa do sistema de salvamento e confirmação de endereços no
> formulário de orçamento**

---

## 1. Propósito

O sistema de gerenciamento de endereços permite que usuários logados salvem
endereços de entrega para facilitar futuras solicitações de orçamento, seguindo
um padrão similar ao iFood.

---

## 2. Visão Geral do Fluxo

```
Usuário preenche formulário de orçamento
    ↓
Usuário clica em "Enviar Orçamento"
    ↓
Sistema verifica condições:
    ↓
┌─────────────────────────────────────┐
│ Primeira vez (0 endereços) +        │ → Dialog: "Deseja salvar endereço?"
│ endereço completo                   │ → Salvar ou Não salvar
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Segunda vez (1 endereço) +          │ → Dialog: "Confirma endereço?"
│ confirmação não dispensada          │ → Checkbox "Não exibir novamente"
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Múltiplos endereços (2+)            │ → Dialog: "Selecione endereço"
│                                     │ → Lista de endereços salvos
└─────────────────────────────────────┘
    ↓
Enviar orçamento com endereço selecionado/preenchido
```

---

## 3. Componentes do Sistema

### 3.1. API Routes

**Localização**: `app/api/addresses/route.ts`

#### GET `/api/addresses`

**Autenticação**: Requerida (usuário logado)

**Resposta**:

```typescript
{
  addresses: Array<{
    id: string
    street: string
    number: string
    complement: string | null
    neighborhood: string
    city: string
    state: string
    zipCode: string
    isPrimary: boolean
    createdAt: string
    updatedAt: string
  }>
}
```

**Comportamento**:

- Lista todos os endereços do usuário logado
- Ordenação: `isPrimary DESC, createdAt DESC` (endereço principal primeiro,
  depois mais recentes)

#### POST `/api/addresses`

**Autenticação**: Requerida (usuário logado)

**Body**:

```typescript
{
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isPrimary?: boolean
}
```

**Resposta**:

```typescript
{
  address: {
    id: string
    // ... outros campos
  }
}
```

**Comportamento**:

- Valida dados com Zod schema
- Se `isPrimary === true`, marca outros endereços como `isPrimary = false`
- Se é o primeiro endereço, sempre marca como `isPrimary = true`
- Cria endereço no banco de dados

---

### 3.2. Componentes de Dialogs

#### SaveAddressDialog

**Localização**:
`packages/frontend/src/pages/orcamento/ui/SalvarEndereco.web.tsx`

**Props**:

```typescript
interface SaveAddressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: AddressData
  onSave: () => Promise<void>
  onSkip: () => void
}
```

**Quando exibir**:

- Usuário está logado
- Usuário tem 0 endereços salvos
- Formulário de endereço está completo e válido

**Layout**:

- Dialog compact (variante `compact` do Base UI)
- Título: "Salvar endereço"
- Pergunta: "Deseja salvar este endereço para futuras solicitações?"
- Botões: "Não salvar" (outline) e "Salvar" (default)

#### ConfirmAddressDialog

**Localização**:
`packages/frontend/src/pages/orcamento/ui/ConfirmarEndereco.web.tsx`

**Props**:

```typescript
interface ConfirmAddressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: Address
  onConfirm: () => void
  onCancel: () => void
  onDismissChange: (dismissed: boolean) => void
}
```

**Quando exibir**:

- Usuário está logado
- Usuário tem 1 endereço salvo
- Checkbox "Não exibir novamente" NÃO está marcada
- Endereço não foi preenchido manualmente

**Layout**:

- Dialog compact (variante `compact`)
- Título: "Confirmar endereço"
- Pergunta: "Você confirma o endereço de entrega?"
- Endereço formatado exibido em card
- Checkbox: "Não exibir novamente"
- Botões: "Cancelar" (outline) e "Confirmar" (default)

**Persistência**:

- Checkbox salva preferência em `localStorage`:
  `addressConfirmationDismissed-{userId}`

#### SelectAddressDialog

**Localização**:
`packages/frontend/src/pages/orcamento/ui/SelecionarEndereco.web.tsx`

**Props**:

```typescript
interface SelectAddressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  addresses: Address[]
  onSelect: (addressId: string) => void
  onUseOther: () => void
  onCancel: () => void
}
```

**Quando exibir**:

- Usuário está logado
- Usuário tem 2 ou mais endereços salvos
- Endereço não foi preenchido manualmente

**Layout**:

- Dialog default (variante `default`)
- Título: "Selecione o endereço de entrega"
- Lista de endereços como cards clicáveis
- Badge "Principal" quando `isPrimary === true`
- Ícone MapPin do lucide-react
- Botões: "Usar outro endereço" (outline) e "Cancelar" (outline)

---

### 3.3. Funções Utilitárias

#### formatAddress

**Localização**: `packages/domain/src/orcamento/documento.ts` (exportada por
`@gb-locacoes/domain/orcamento`)

**Assinatura**:

```typescript
function formatAddress(address: {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
}): string
```

**Formato de saída**:

```
"Rua, Número - Complemento - Bairro - Cidade/Estado - CEP"
```

**Exemplo**:

```
"Rua das Flores, 123 - Apto 101 - Centro - Porto Alegre/RS - 90000-000"
```

#### isAddressComplete

**Localização**: `app/orcamento/page.tsx` (função auxiliar)

**Assinatura**:

```typescript
function isAddressComplete(address: AddressData): boolean
```

**Validação**:

- Verifica se todos os campos obrigatórios estão preenchidos
- Campos: `cep`, `logradouro`, `numero`, `bairro`, `cidade`, `estado`
- `complemento` é opcional

---

## 4. Fluxo de Decisão

### 4.1. Condições para Exibir Dialogs

O sistema verifica as seguintes condições na ordem especificada:

1. **Dialog de Salvamento**:
   - ✅ Usuário logado (`session?.user?.id`)
   - ✅ Tipo de entrega = `DELIVERY`
   - ✅ 0 endereços salvos (`userAddresses.length === 0`)
   - ✅ Endereço está completo (`isAddressComplete(formData.deliveryAddress)`)

2. **Dialog de Confirmação**:
   - ✅ Usuário logado
   - ✅ Tipo de entrega = `DELIVERY`
   - ✅ 1 endereço salvo (`userAddresses.length === 1`)
   - ✅ Confirmação não foi dispensada (`!isAddressConfirmationDismissed`)
   - ✅ Endereço não foi preenchido manualmente (`!formData.deliveryAddress`)

3. **Dialog de Seleção**:
   - ✅ Usuário logado
   - ✅ Tipo de entrega = `DELIVERY`
   - ✅ 2+ endereços salvos (`userAddresses.length >= 2`)
   - ✅ Endereço não foi preenchido manualmente (`!formData.deliveryAddress`)

### 4.2. Regras de Negócio

1. **Primeiro endereço sempre é principal**: Ao criar primeiro endereço,
   `isPrimary = true` automaticamente
2. **Checkbox "Não exibir novamente"**: Funciona apenas quando usuário tem 1
   endereço. Com múltiplos, sempre mostrar dialog de seleção
3. **Endereço manual vs. salvo**: Se usuário preencher manualmente, não mostrar
   dialogs (usar o manual)
4. **Sessão expirada**: Se não logado, fluxo normal sem dialogs
5. **Validação antes de salvar**: Verificar campos obrigatórios antes de POST
   para `/api/addresses`

---

## 5. Estrutura de Dados

### 5.1. Model Address (Prisma)

```prisma
model Address {
  id           String   @id @default(cuid())
  userId       String
  street       String
  number       String
  complement   String?
  neighborhood String
  city         String
  state        String
  zipCode      String
  isPrimary    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 5.2. Interface AddressData (Formulário)

```typescript
interface AddressData {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}
```

### 5.3. Mapeamento AddressData ↔ Address

**AddressData (formulário) → Address (API)**:

- `cep` → `zipCode`
- `logradouro` → `street`
- `numero` → `number`
- `complemento` → `complement`
- `bairro` → `neighborhood`
- `cidade` → `city`
- `estado` → `state`

---

## 6. Integração no Formulário de Orçamento

**Localização**: `app/orcamento/page.tsx`

### 6.1. Estados Adicionados

```typescript
const [userAddresses, setUserAddresses] = useState<Address[]>([])
const [saveAddressDialogOpen, setSaveAddressDialogOpen] = useState(false)
const [confirmAddressDialogOpen, setConfirmAddressDialogOpen] = useState(false)
const [selectAddressDialogOpen, setSelectAddressDialogOpen] = useState(false)
const [selectedSavedAddress, setSelectedSavedAddress] =
  useState<Address | null>(null)
```

### 6.2. Hook useMemo para localStorage

```typescript
const isAddressConfirmationDismissed = useMemo(() => {
  if (!session?.user?.id) return false
  if (typeof window === "undefined") return false
  return (
    localStorage.getItem(`addressConfirmationDismissed-${session.user.id}`) ===
    "true"
  )
}, [session?.user?.id])
```

### 6.3. Modificação no handleSubmit

A lógica de verificação de endereços é executada **ANTES** do envio do
orçamento, após todas as validações de formulário.

---

## 7. Callbacks dos Dialogs

### 7.1. handleSaveAddress

- Faz POST para `/api/addresses`
- Atualiza lista de endereços (`loadUserAddresses`)
- Fecha dialog
- Continua com envio do orçamento (`submitQuote`)

### 7.2. handleSkipSaveAddress

- Fecha dialog
- Continua com envio do orçamento sem salvar

### 7.3. handleConfirmAddress

- Preenche formulário com endereço salvo
- Fecha dialog
- Continua com envio do orçamento

### 7.4. handleDismissConfirmation

- Salva/remove preferência no `localStorage`
- Formato: `addressConfirmationDismissed-{userId}`

### 7.5. handleSelectAddress

- Preenche formulário com endereço selecionado
- Fecha dialog
- Continua com envio do orçamento

### 7.6. handleUseOtherAddress

- Fecha dialog
- Permite preencher endereço manualmente

---

## 8. Estilos e Design

### 8.1. Dialogs Compact (Save/Confirm)

- Variante: `Dialog.Popup variant="compact"`
- Header com título e ícone MapPin
- Footer com botões lado a lado

### 8.2. Dialog Default (Select)

- Variante: `Dialog.Popup variant="default"`
- Cards de endereço:
  - `border border-slate-200 rounded-lg p-4`
  - `hover:border-orange-500 hover:bg-orange-50/50 transition-colors`
- Badge Principal:
  - `<Badge variant="default" className="bg-orange-600 text-white">Principal</Badge>`

---

## 9. Testes e Validação

### 9.1. Cenários de Teste

1. ✅ Usuário logado, primeira solicitação, endereço completo → Dialog de
   salvamento
2. ✅ Usuário logado, segunda solicitação, 1 endereço → Dialog de confirmação
3. ✅ Checkbox "Não exibir novamente" → Não exibir mais (1 endereço)
4. ✅ Usuário tem 2+ endereços → Sempre dialog de seleção
5. ✅ Usuário não logado → Fluxo normal (sem dialogs)
6. ✅ Endereço preenchido manualmente → Não mostrar dialogs
7. ✅ Salvamento de endereço → Criar no banco corretamente
8. ✅ Seleção de endereço → Preencher formulário corretamente

---

## 10. Referências

- **API de Endereços**: `app/api/addresses/route.ts`
- **Formulário de Orçamento**:
  `packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx` (rota fina em
  `app/orcamento/page.tsx`)
- **Componentes de Dialogs**:
  `packages/frontend/src/pages/orcamento/ui/SalvarEndereco.web.tsx`,
  `packages/frontend/src/pages/orcamento/ui/ConfirmarEndereco.web.tsx`,
  `packages/frontend/src/pages/orcamento/ui/SelecionarEndereco.web.tsx`
- **Função formatAddress**: `packages/domain/src/orcamento/documento.ts`
- **Dialog Lab**: `docs/features/dialog-lab.md`
- **Design System**: `docs/features/design-system.md`

---

_Última atualização: 2026-01-02_
