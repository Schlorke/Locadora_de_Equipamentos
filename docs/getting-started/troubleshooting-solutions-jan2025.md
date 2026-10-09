# 🔧 Soluções de Problemas - Janeiro 2025

> **Caminhos atuais (conferidos em 2026-09-30)**: registro histórico de janeiro
> de 2025. `lib/telemetry.ts`, `lib/metrics.ts` e a página `/admin/analytics`
> não existem mais (ver `docs/features/analytics-dashboard.md`), e os schemas
> gerados em `lib/validations/schemas` saíram em 2026-09-30 com o gerador
> (entrada 227 de `docs/issues/known-issues.md`). Para problemas atuais, use
> `troubleshooting.md`.

> **Última Atualização**: 15 de Janeiro de 2025  
> **Contexto**: Problemas enfrentados e solucionados durante implementação do
> Dashboard Analytics

## 📋 **Resumo dos Problemas Resolvidos**

Durante a implementação do Dashboard de Analytics e melhorias de code quality,
enfrentamos e resolvemos diversos problemas técnicos importantes. Este documento
serve como referência para futuras implementações e para orientar IAs sobre
soluções já testadas.

---

## 🚨 **PROBLEMAS CRÍTICOS DE BUILD**

### **❌ Problema: "Module not found: Can't resolve '@/lib/validations'"**

#### **🔍 Sintomas**

```bash
Failed to compile.

./app/api/contact/route.ts
Module not found: Can't resolve '@/lib/validations'

./app/api/quotes/route.ts
Module not found: Can't resolve '@/lib/validations'
```

#### **🧠 Causa Raiz**

- O arquivo `lib/validations/index.ts` estava sendo deletado automaticamente
  pelo `prisma-zod-generator`
- O gerador do Prisma sobrescreve o diretório `lib/validations/` durante
  execução
- Scripts de `prebuild` executavam `prisma generate` que destruía arquivos
  customizados

#### **✅ Solução Implementada**

1. **Criação manual do arquivo** após cada `prisma generate`:

```bash
# PowerShell
New-Item -Path lib\validations\index.ts -ItemType File -Force
```

2. **Conteúdo mínimo necessário**:

```typescript
// lib/validations/index.ts
export { QuoteStatusSchema as QuoteStatus } from "./schemas/enums/QuoteStatus.schema"
export { RoleSchema as Role } from "./schemas/enums/Role.schema"

import { z } from "zod"

export const ContactSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("Email inválido"),
  company: z.string().optional(),
  equipments: z.string().optional(),
  message: z.string().min(1, "Mensagem é obrigatória")
})

export const QuoteRequestSchema = z.object({
  customerName: z.string().min(1, "Nome é obrigatório"),
  customerPhone: z.string().min(1, "Telefone é obrigatório"),
  customerEmail: z.string().email("Email inválido"),
  customerCompany: z.string().optional(),
  message: z.string().optional(),
  items: z
    .array(
      z.object({
        equipmentId: z.string().min(1),
        quantity: z.number().int().min(1),
        days: z.number().int().min(1)
      })
    )
    .min(1)
})
```

3. **Procedimento de emergência**:

```bash
# Se o build falhar, execute:
pnpm db:generate
# Depois recrie o arquivo index.ts com o conteúdo acima
# Então execute:
pnpm build
```

#### **🛡️ Prevenção**

- **NUNCA delete** o arquivo `lib/validations/index.ts`
- **SEMPRE recrie** após executar `prisma generate`
- **Considere proteção** do arquivo via git ou scripts automáticos

---

### **❌ Problema: "ssr: false is not allowed with next/dynamic in Server Components"**

#### **🔍 Sintomas**

```bash
Error: x `ssr: false` is not allowed with `next/dynamic` in Server Components.
Please move it into a Client Component.
```

#### **🧠 Causa Raiz**

- Componente `SwaggerUI` sendo importado dinamicamente em Server Component
- Next.js 16 tem regras mais rígidas sobre SSR em App Router
- `swagger-ui-react` não é compatível com Server-Side Rendering

#### **✅ Solução Implementada**

```typescript
// app/api-docs/page.tsx
'use client' // ← ADICIONAR ESTA LINHA

import 'swagger-ui-react/swagger-ui.css'
import dynamic from 'next/dynamic'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => <p>Loading Component...</p>,
})

export default function ApiDocsPage() { // ← REMOVER 'async'
  return (
    <section>
      <SwaggerUI url="/openapi.json" />
    </section>
  )
}
```

#### **🛡️ Prevenção**

- **SEMPRE use** `'use client'` para componentes com `dynamic` imports
- **REMOVA `async`** de componentes Client-side
- **TESTE o build** após modificações em componentes dinâmicos

---

## 💻 **PROBLEMAS DE CODE QUALITY**

### **❌ Problema: ESLint "Unexpected any" Warnings (70+ warnings)**

#### **🔍 Sintomas**

```bash
./lib/telemetry.ts
47:30  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
90:30  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
```

#### **🧠 Causa Raiz**

- Uso excessivo de tipo `any` em sistemas de telemetria e métricas
- Falta de interfaces específicas para objetos complexos
- Parameters genéricos mal tipados

#### **✅ Soluções Implementadas**

**1. Substituição de `any` por `unknown`:**

```typescript
// ❌ Antes
function handleData(data: any) {
  // ...
}

// ✅ Depois
function handleData(data: unknown) {
  // ...
}
```

**2. Criação de interfaces específicas:**

```typescript
// lib/metrics.ts
interface RequestLike {
  url?: string
  method?: string
  headers?: Record<string, string | string[]>
  ip?: string
  connection?: { remoteAddress?: string }
  user?: { id?: string; role?: string }
}

interface ResponseLike {
  statusCode?: number
  send?: (body: unknown) => void
}
```

**3. Union types para variants:**

```typescript
// app/admin/analytics/page.tsx
<Badge
  variant={
    getSeverityColor(anomaly.severity) as
      | 'default'
      | 'destructive'
      | 'outline'
      | 'secondary'
  }
/>
```

**4. Generics tipados corretamente:**

```typescript
// lib/telemetry.ts
export function withTracing<T extends unknown[], R>(
  name: string,
  fn: (...args: T) => Promise<R> | R,
  attributes: Record<string, string | number | boolean> = {}
) {
  // ...
}
```

#### **📊 Resultado**

- **Antes**: ~70 warnings de `any` types
- **Depois**: ~6 warnings (apenas em arquivos auto-gerados)
- **Melhoria**: ~90% de redução

---

### **❌ Problema: "Variable is assigned but never used" Warnings**

#### **🔍 Sintomas**

```bash
./app/api/contact/route.ts
16:9  Warning: 'validatedData' is assigned a value but never used.
```

#### **🧠 Causa Raiz**

- Variáveis criadas para validação mas não utilizadas posteriormente
- Resultado de operações necessárias mas valor não consumido

#### **✅ Soluções Implementadas**

**1. Prefixo com underscore:**

```typescript
// ❌ Antes
const validatedData = ContactSchema.parse(body)

// ✅ Depois
const _validatedData = ContactSchema.parse(body)
```

**2. Remoção da variável (quando apenas validação):**

```typescript
// ✅ Melhor ainda
ContactSchema.parse(body) // Apenas validação, sem armazenar
```

**3. Desestruturação para ignorar:**

```typescript
// Se apenas parte é usada
const { name, _unusedField } = someObject
```

---

## 🎨 **PROBLEMAS DE UI/UX**

### **❌ Problema: Badge Variant Type Errors**

#### **🔍 Sintomas**

```bash
Type 'string' is not assignable to type '"default" | "destructive" | "outline" | "secondary"'
```

#### **🧠 Causa Raiz**

- Função `getSeverityColor()` retorna `string`
- Component `Badge` espera union type específico
- TypeScript não consegue inferir o tipo correto

#### **✅ Solução Implementada**

```typescript
// Função helper com retorno tipado
const getSeverityColor = (severity: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
  switch (severity.toLowerCase()) {
    case 'high': return 'destructive'
    case 'medium': return 'outline'
    default: return 'secondary'
  }
}

// Uso com cast explícito como fallback
<Badge
  variant={
    getSeverityColor(anomaly.severity) as
      | 'default'
      | 'destructive'
      | 'outline'
      | 'secondary'
  }
/>
```

---

### **❌ Problema: Animações Não Funcionando no Dashboard**

#### **🔍 Sintomas**

- Componentes aparecendo sem transições suaves
- Gráficos carregando abruptamente
- Falta de feedback visual em interações

#### **🧠 Causa Raiz**

- Framer Motion não configurado corretamente
- Componentes re-renderizando sem preservar estado de animação
- Falta de `AnimatePresence` para saída de elementos

#### **✅ Soluções Implementadas**

**1. AnimatePresence para conditional rendering:**

```typescript
import { AnimatePresence, motion } from 'framer-motion'

<AnimatePresence>
  {analytics.anomalies?.length > 0 && (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Conteúdo das anomalias */}
    </motion.div>
  )}
</AnimatePresence>
```

**2. Staggered animations para listas:**

```typescript
{analytics.topEndpoints.map((endpoint, i) => (
  <motion.div
    key={i}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: i * 0.05 }} // Stagger effect
  >
    {/* Item content */}
  </motion.div>
))}
```

**3. Layout animations para gráficos:**

```typescript
<motion.div
  initial={{ height: 0 }}
  animate={{ height: `${Math.max(height, 2)}%` }}
  transition={{ delay: hour * 0.02 + 0.2, duration: 0.5 }}
  className="w-full rounded-t-sm bg-orange-500"
/>
```

---

## 🔧 **PROBLEMAS DE DEVELOPMENT WORKFLOW**

### **❌ Problema: PowerShell Syntax Errors**

#### **🔍 Sintomas**

```bash
The term '&&' is not recognized as the name of a cmdlet, function, script file
```

#### **🧠 Causa Raiz**

- PowerShell não reconhece operador `&&` do bash/zsh
- Comandos concatenados não funcionam nativamente
- Scripts de package.json podem falhar no Windows

#### **✅ Soluções Implementadas**

**1. Comandos individuais:**

```bash
# ❌ Não funciona no PowerShell
pnpm db:generate && pnpm build

# ✅ Funciona
pnpm db:generate
pnpm build
```

**2. Scripts separados no package.json:**

```json
{
  "scripts": {
    "prebuild": "prisma generate",
    "build": "next build",
    "db:generate": "prisma generate"
  }
}
```

**3. Uso de npx quando necessário:**

```bash
npx next build  # Em vez de usar scripts pnpm que podem falhar
```

---

## 📊 **PROBLEMAS DE PERFORMANCE**

### **❌ Problema: Loading States Inadequados**

#### **🔍 Sintomas**

- Dashboard carregando sem feedback visual
- Usuário sem saber se aplicação está funcionando
- Experiência ruim durante fetch de dados

#### **🧠 Causa Raiz**

- Estados de loading não implementados adequadamente
- Falta de skeleton screens
- Loading spinners simples demais

#### **✅ Soluções Implementadas**

**1. Skeleton screens detalhados:**

```typescript
{loading && (
  <div className="space-y-6 p-6">
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
    </div>
  </div>
)}
```

**2. Loading spinners animados:**

```typescript
<RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
```

**3. Estados de loading inteligentes:**

```typescript
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

// Loading apenas durante fetch, não durante renders
```

---

## 🔒 **PROBLEMAS DE SEGURANÇA E ACESSO**

### **❌ Problema: Middleware de Autenticação Inconsistente**

#### **🔍 Sintomas**

- APIs admin acessíveis sem autenticação adequada
- Tipos de role não verificados consistentemente
- Middleware não aplicado uniformemente

#### **🧠 Causa Raiz**

- Falta de padronização nos middlewares de auth
- Verificação de roles manual e propensa a erros
- Imports dinâmicos quebrando verificações

#### **✅ Soluções Implementadas**

**1. Middleware padronizado:**

```typescript
// middlewares/require-admin.ts
export async function requireAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    )
  }

  return null // Success - continue
}
```

**2. Wrapper para APIs admin:**

```typescript
export const withAdminAuth = (handler: Function) => {
  return async (request: NextRequest, ...args: any[]) => {
    const authError = await requireAdmin(request)
    if (authError) return authError

    return handler(request, ...args)
  }
}
```

**3. Aplicação consistente:**

```typescript
// app/api/admin/analytics/route.ts
export const GET = withAdminAuth(async (request: NextRequest) => {
  // Lógica do endpoint
})
```

---

## 📈 **LIÇÕES APRENDIDAS**

### **🎯 Principais Insights**

1. **Build Stability é Crítico**
   - Sempre teste builds após mudanças em dependencies
   - Prisma generators podem quebrar arquivos customizados
   - Mantenha backups de arquivos críticos

2. **Type Safety Paga Dividendos**
   - Investimento inicial em tipos corretos evita bugs futuros
   - `unknown` é preferível a `any` na maioria dos casos
   - Union types e interfaces específicas melhoram DX

3. **UX Requer Atenção aos Detalhes**
   - Loading states fazem diferença significativa na percepção
   - Animações suaves melhoram profissionalismo
   - Error handling gracioso constrói confiança

4. **Documentação é Ferramenta de Debug**
   - Problemas bem documentados aceleram resolução futura
   - IAs precisam de contexto histórico para evitar regressões
   - Soluções testadas devem ser preservadas

### **⚠️ Armadilhas a Evitar**

1. **Não modificar arquivos auto-gerados** sem backup
2. **Não usar `any`** sem justificativa muito forte
3. **Não implementar UI** sem estados de loading/error
4. **Não fazer mudanças** sem testar build completo
5. **Não ignorar warnings** de TypeScript/ESLint

### **🔮 Preparação para Futuro**

1. **Monitoring Contínuo**: Sistema implementado detectará problemas antes
2. **Type Safety**: Base sólida para expansões futuras
3. **Component Library**: Design system facilita novas features
4. **Documentation**: Base para onboarding de novos desenvolvedores
5. **Testing Infrastructure**: Proteção contra regressões

---

## 📞 **Suporte e Referências**

### **🔗 Links Úteis**

- **Documentação Principal**: `docs/README.md`
- **Guia de Desenvolvimento**: `docs/getting-started/development.md`
- **Dashboard Analytics**: `docs/features/analytics-dashboard.md`
- **Troubleshooting Geral**: `docs/getting-started/troubleshooting.md`

### **🚨 Escalação de Problemas**

1. **Consulte esta documentação** para problemas conhecidos
2. **Verifique logs** do browser e servidor
3. **Teste em ambiente limpo** (npm clean, rebuild)
4. **Documente novos problemas** para futuras referências

---

**📝 Nota Final**: Este documento deve ser atualizado sempre que novos problemas
forem identificados e resolvidos. A documentação de problemas é tão importante
quanto a documentação de funcionalidades.
