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

Depois de validar o pedido, `use-quote-page.ts` consulta os endereços da sessão
na locadora ativa. Para DELIVERY, um endereço completo novo oferece salvamento,
inclusive quando já existem outros endereços. Endereço igual a um salvo sem
novos dados do cliente segue sem dialog. Sem endereço manual, uma única opção
pode pedir confirmação e duas ou mais podem abrir a seleção.

Confirmar, selecionar, salvar ou dispensar continua o pedido; cancelar ou
escolher «outro endereço» apenas fecha o dialog para edição. A preferência de
confirmação e as leituras pertencem ao par locadora/usuário, não a uma sessão
global compartilhada entre vitrines.

## 3. Componentes do Sistema

### 3.1. API Routes

**Localização**: `apps/services/api/src/app/api/addresses/route.ts` e
`addresses/[id]/route.ts`. Composição em `host/customers.ts`, serviço
`packages/backend/src/modules/customers/addresses.ts` e schemas
`packages/contracts/src/addresses.ts`. O cliente usa
`packages/frontend/src/entities/cliente/api/customer-api.ts`, pelo HttpClient
capturado no escopo, sem consultar o banco diretamente.

O principal vem de `host/private-identity.ts`: sessão, preferência/borda e
membership são revalidados. Todas as consultas/escritas usam tenantId + userId,
com `withTenantTransaction`. Escritas ainda conferem mesma origem antes do
corpo; dados do formulário não escolhem tenantId ou dono. Id alheio no PATCH ou
DELETE responde 404. CEP/geocoding da UI não substitui essa autorização.

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

- Lista os endereços do usuário logado SOMENTE na locadora resolvida
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

- Valida `AddressInputSchema`: textos aparados/não vazios, UF de duas letras
  normalizada para maiúsculas e CEP de oito dígitos, com hífen opcional.
- Sob a trava `tenantId:addresses:userId`, o primeiro endereço vira principal e
  um novo principal desmarca apenas os outros desse usuário nessa locadora.
- Cria no banco com o principal resolvido e retorna 201.
- PATCH usa o schema parcial e preserva o mesmo escopo/trava; DELETE promove o
  endereço restante mais antigo (createdAt/id) se removeu o principal.

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
  isAddressNew?: boolean
  customerInfo?: {
    phone?: string
    cpf?: string
    cnpj?: string
    company?: string
  }
  onSave: () => Promise<void>
  onSkip: () => void
}
```

**Quando exibir**:

- Usuário está logado
- Formulário de endereço está completo e válido
- Endereço novo, inclusive com endereços anteriores; a página também verifica
  dados comerciais novos. Endereço igual ao salvo não é criado novamente.

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

- A chave atual é `addressConfirmationDismissed:` +
  `JSON.stringify([tenantSlug, userId])`.
- O modelo recebe `QuotePagePorts.preferences`; a variante web fornece
  localStorage e a nativa usa `use-quote-preferences.ts` com storage assíncrono.
  Não copiar uma chave só por userId: ela vazaria preferência entre locadoras.
  Falha de persistência nativa é visível, sem apagar a sessão.

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

**Localização**: `packages/frontend/src/entities/orcamento/model/envio.ts`,
exportada pelo index da entidade e consumida por `use-quote-page.ts`. A função
testa presença dos campos; validação do schema HTTP e CEP continuam nas suas
camadas. Não restaurar a função no wrapper da rota.

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

Ordem real de `use-quote-page.ts`, após validações de formulário/período:

1. Para usuário logado e DELIVERY, carregar endereços no cliente capturado.
2. Se há endereço completo e novo, oferecer salvamento tanto na primeira vez
   quanto com endereços prévios. A comparação normaliza CEP e campos textuais em
   `isAddressDifferent`; dados comerciais novos também são verificados.
3. Endereço completo igual ao salvo e sem dados comerciais novos segue direto.
4. Uma opção salva, sem dispensa e sem endereço manual, abre confirmação.
   Endereço manual não passa pelo dialog de confirmação.
5. Duas ou mais opções, sem endereço manual, abrem seleção.
6. Nos demais casos, continuar o pedido e a verificação própria de dados do
   cliente. Sem sessão não solicitar salvamento privado.

### 4.2. Regras de Negócio

1. **Primeiro endereço sempre é principal**: Ao criar primeiro endereço,
   `isPrimary = true` automaticamente
2. **Checkbox "Não exibir novamente"**: Funciona apenas quando usuário tem 1
   endereço. Com múltiplos, sempre mostrar dialog de seleção
3. **Endereço manual vs. salvo**: usa o manual, sem confirmação/seleção; se ele
   for completo e novo, pode oferecer salvar antes de enviar.
4. **Sessão expirada**: Se não logado, fluxo normal sem dialogs
5. **Validação antes de salvar**: Verificar campos obrigatórios antes de POST
   para `/api/addresses`

---

## 5. Estrutura de Dados

### 5.1. Model Address (Prisma)

```prisma
model Address {
  tenantId     String? // Só linhas legadas sem atribuição ficam em quarentena
  organization Organization? @relation(fields: [tenantId], references: [id], onDelete: Restrict)
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

  @@index([userId])
  @@map("addresses")
  @@index([tenantId])
  @@unique([id, tenantId])
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

**Localização**:
`packages/frontend/src/pages/orcamento/model/use-quote-page.ts`, renderizado por
`OrcamentoPage.web.tsx`/`OrcamentoPage.native.tsx`. A rota web fina é
`apps/clients/web/src/app/(public)/[locadora]/(vitrine)/orcamento/page.tsx`. A
gestão na área do cliente usa `pages/enderecos/model/use-addresses.ts` e
`EnderecosPage.web.tsx`/`EnderecosPage.native.tsx`.

### 6.1. Estados Adicionados

```typescript
const [userAddresses, setUserAddresses] = useState<Address[]>([])
const [saveAddressDialogOpen, setSaveAddressDialogOpen] = useState(false)
const [confirmAddressDialogOpen, setConfirmAddressDialogOpen] = useState(false)
const [selectAddressDialogOpen, setSelectAddressDialogOpen] = useState(false)
const [selectedSavedAddress, setSelectedSavedAddress] =
  useState<Address | null>(null)
```

### 6.2. Preferência pela porta de persistência

O trecho atual do modelo não acessa DOM nem localStorage:

```typescript
const preferenceKey = useCallback(
  (name: string) =>
    `${name}:${JSON.stringify([tenantSlug, session?.user?.id])}`,
  [tenantSlug, session?.user?.id]
)
const isAddressConfirmationDismissed = useMemo(() => {
  if (!session?.user?.id) return false
  return (
    ports.preferences.getItem(preferenceKey("addressConfirmationDismissed")) ===
    "true"
  )
}, [session?.user?.id, ports.preferences, preferenceKey])
```

`useQuotePageScope` inclui locadora, vínculo/papel, usuário, status da sessão e
revisão do cliente HTTP. A variante remonta o modelo ao mudar o escopo;
respostas antigas são descartadas pelo cliente capturado. O adapter nativo
carrega a preferência antes de fornecer a porta síncrona ao modelo.

### 6.3. Modificação no handleSubmit

A lógica de verificação de endereços é executada **ANTES** do envio do
orçamento, após todas as validações de formulário.

---

## 7. Callbacks dos Dialogs

### 7.1. handleSaveAddress

- Se o endereço é novo, chama `api.saveAddress`; se há dados comerciais novos,
  também chama `api.saveProfile`.
- Usa Promise.allSettled para conservar sucesso parcial; recusa de uma gravação
  não desfaz o efeito aceito da outra. AbortError de escopo encerra a
  continuação.
- Recarrega os dados aplicáveis, fecha o dialog e continua `submitQuote` apenas
  pelo caminho previsto do modelo; falhas são apresentadas ao usuário.

### 7.2. handleSkipSaveAddress

- Fecha dialog
- Continua com envio do orçamento sem salvar

### 7.3. handleConfirmAddress

- Preenche formulário com endereço salvo
- Fecha dialog
- Continua com envio do orçamento

### 7.4. handleDismissConfirmation

- Salva/remove pela porta `preferences`.
- Chave: `addressConfirmationDismissed:` +
  `JSON.stringify([tenantSlug, userId])`; web e native conservam esse contrato.

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
4. Usuário tem 2+ endereços e nenhum endereço manual → Dialog de seleção
5. ✅ Usuário não logado → Fluxo normal (sem dialogs)
6. Endereço manual igual ao salvo → Não repetir confirmação; manual novo
   completo → Pode oferecer salvamento
7. ✅ Salvamento de endereço → Criar no banco corretamente
8. ✅ Seleção de endereço → Preencher formulário corretamente

---

## 10. Referências

- **API de Endereços**: `apps/services/api/src/app/api/addresses/route.ts` e
  `addresses/[id]/route.ts`
- **Formulário de Orçamento**:
  `packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx` (rota fina em
  `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/orcamento/page.tsx`)
- **Componentes de Dialogs**:
  `packages/frontend/src/pages/orcamento/ui/SalvarEndereco.web.tsx`,
  `packages/frontend/src/pages/orcamento/ui/ConfirmarEndereco.web.tsx`,
  `packages/frontend/src/pages/orcamento/ui/SelecionarEndereco.web.tsx`
- **Função formatAddress**: `packages/domain/src/orcamento/documento.ts`
- **Dialog Lab**: `docs/features/dialog-lab.md`
- **Design System**: `docs/features/design-system.md`

---

_Última atualização: 2026-01-02_
