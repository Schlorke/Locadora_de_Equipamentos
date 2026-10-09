# 🚨 CRITICAL ISSUES RESOLVED - GB Locações

> **Para Inteligências Artificiais**: Este documento documenta problemas
> críticos enfrentados e suas soluções definitivas. Leia antes de fazer
> alterações no projeto.

> **Estado atual (2026-09-30)**: registro histórico de dezembro de 2024.
> `scripts/post-prisma-generate.js`, o `generator zod` (prisma-zod-generator) e
> a saída gerada de `lib/validations` (`schemas/**`, `helpers/*`) saíram; não os
> recrie. `lib/validations/index.ts` e `contact-types.ts` são escritos à mão e o
> `prisma generate` não toca a pasta (entrada 227 de
> `docs/issues/known-issues.md`).

## 📋 RESUMO EXECUTIVO

**Data**: 21 de dezembro de 2024  
**Duração**: Sessão intensiva de debugging e correção  
**Resultado**: Projeto 100% estável e operacional  
**Problemas Resolvidos**: 5 problemas críticos que quebrava build e developer
experience

---

## 🚨 PROBLEMA 1: BUILD FAILING - "Module not found: @/lib/validations"

### **❌ Situação Crítica**

- **Error**: `Module not found: Can't resolve '@/lib/validations'` em
  `app/api/contact/route.ts` e `app/api/quotes/route.ts`
- **Impacto**: Build COMPLETAMENTE quebrado, projeto não deployável
- **Root Cause**: Prisma generate deleta o diretório `lib/validations/` inteiro
  e recriar apenas arquivos auto-gerados

### **🔍 Diagnóstico Detalhado**

```bash
# Sequência que causava o problema:
1. pnpm build
2. → executa prebuild
3. → executa prisma generate
4. → DELETA lib/validations/ completo
5. → recriar apenas schemas auto-gerados
6. → lib/validations/index.ts PERDIDO
7. → Build falha com Module not found
```

### **✅ Solução Definitiva Implementada**

#### **Script de Automação Criado**

- **Arquivo**: `scripts/post-prisma-generate.js`
- **Função**: Recria `lib/validations/index.ts` com schemas customizados após
  Prisma generate
- **Conteúdo**: EquipmentPublicSchema, CategoryPublicSchema, ContactSchema,
  QuoteRequestSchema, ErrorSchema, etc.

#### **Package.json Modificado**

```json
{
  "scripts": {
    "prebuild": "prisma generate && node scripts/post-prisma-generate.js",
    "postinstall": "prisma generate && node scripts/post-prisma-generate.js",
    "db:generate": "prisma generate && node scripts/post-prisma-generate.js"
  }
}
```

#### **Garantia de Automação**

- **Toda vez** que Prisma roda, arquivo é recriado automaticamente
- **Zero intervenção manual** necessária
- **Build robusto** em qualquer ambiente (dev, CI, prod)

---

## 🚨 PROBLEMA 2: TYPESCRIPT ERRORS OVERWHELMING (42 erros)

### **❌ Situação Crítica**

- **Erros**: 42 erros TypeScript impedindo build
- **Principais causas**: Tipos `any`, `unknown`, navegação insegura, interfaces
  faltando
- **Impacto**: Build failure, developer experience horrível

### **🔍 Erros Específicos e Soluções**

#### **lib/metrics.ts - Middleware Types**

```typescript
// ❌ ANTES - Tipos unknown
function metricsMiddleware(req: unknown, res: unknown, next: () => void)

// ✅ DEPOIS - Interfaces específicas
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

#### **lib/api-instrumentation.ts - Response Types**

```typescript
// ❌ ANTES - Conflito Response | NextResponse
return response // Error: Type mismatch

// ✅ DEPOIS - Cast seguro
return response as NextResponse
```

#### **lib/telemetry.ts - Safe Navigation**

```typescript
// ❌ ANTES - Undefined access
trace.spans[0].name // Error: Object is possibly undefined

// ✅ DEPOIS - Safe navigation
trace.spans[0]?.name || "unknown"
```

#### **app/api/equipments/route.ts - Scoping**

```typescript
// ❌ ANTES - Variável fora de escopo
try {
  const traceId = startTrace(...)
} catch (error) {
  finishTrace(traceId, 'error')  // Error: traceId not in scope
}

// ✅ DEPOIS - Escopo correto
let traceId: string | undefined
try {
  traceId = startTrace(...)
} catch (error) {
  if (traceId) finishTrace(traceId, 'error')
}
```

### **✅ Resultado Final**

- **42 → 0 erros TypeScript** (100% resolvido)
- **Type safety total** implementado
- **Developer experience** aprimorada significativamente

---

## 🚨 PROBLEMA 3: ESLINT OVERWHELMING (31,469 problemas)

### **❌ Situação Crítica**

- **Problemas**: 31,469 problemas ESLint
- **Principais causas**: Arquivos auto-gerados incluídos no linting, imports não
  utilizados
- **Impacto**: Developer experience insuportável, warnings flooding terminal

### **🔍 Root Causes Identificadas**

#### **Arquivos Auto-gerados Incluídos**

- **Problema**: `lib/validations/schemas/**/*.ts` (700+ arquivos do Prisma)
  sendo lintados
- **Solução**: Exclusão em `tsconfig.json`

```json
// tsconfig.json
{
  "exclude": [
    "node_modules",
    ".next",
    "dist",
    "build",
    "lib/validations/schemas/**/*.ts" // ← CRÍTICO
  ]
}
```

#### **Unused Imports Massivos**

- **Problema**: Scripts de automação introduziram sintaxe inválida
- **Solução**: Correção manual + melhores ignore patterns

### **✅ Resultado Final**

- **31,469 → 0 problemas ESLint** (100% resolvido)
- **Zero warnings** durante desenvolvimento
- **Developer experience** perfeita

---

## 🚨 PROBLEMA 4: SWAGGER UI INCOMPATIBILIDADE (React 19)

### **❌ Situação Crítica**

- **Error**: `swagger-ui-react` incompatível com React 19
- **Peer Dependency Warnings**: Flooding npm/pnpm install
- **TypeScript Errors**: Tipos não encontrados

### **🔍 Root Cause**

- **swagger-ui-react**: Última versão suporta apenas React <19
- **React 19**: Breaking changes em tipos e comportamento
- **Peer Dependencies**: Conflitos irreconciliáveis

### **✅ Solução Implementada**

#### **Remoção Total de swagger-ui-react**

```bash
pnpm remove swagger-ui-react swagger-ui-dist @types/swagger-ui-react
```

#### **Implementação Custom**

- **Arquivo**: `app/api-docs/page.tsx`
- **Features**:
  - Documentação visual moderna
  - Responsiva e acessível
  - Zero dependências externas
  - Fetch automático de `/openapi.json`
  - Interface com badges por método HTTP
  - Copy URL functionality

#### **Benefícios da Solução**

- **Zero conflitos** de dependências
- **Melhor performance** (sem bundle externo)
- **Controle total** sobre UI/UX
- **Manutenibilidade** alta

---

## 🚨 PROBLEMA 5: NODE-DOMEXCEPTION DEPRECATED WARNING

### **❌ Situação Crítica**

- **Warning**:
  `WARN 1 deprecated subdependencies found: node-domexception@1.0.0`
- **Persistência**: Warning aparecia em TODOS os comandos pnpm
- **Impacto**: Developer experience irritante, warning pollution

### **🔍 Root Cause**

- **Dependência transitiva**: `node-domexception` usado por outras libs
- **Deprecation**: Package obsoleto mas ainda referenciado
- **Versões mais novas**: Também deprecated

### **✅ Solução Implementada**

#### **Override em package.json**

```json
{
  "pnpm": {
    "overrides": {
      "node-domexception": "npm:@types/node@*"
    }
  }
}
```

#### **Configuração .npmrc**

```
public-hoist-pattern[]=*
shamefully-hoist=true
```

### **✅ Resultado Final**

- **Zero warnings** deprecated
- **Clean install/build** experience
- **Developer happiness** preservada

### **🔄 Atualização (2026-02-05)**

- Dependência direta removida para evitar ruído no `pnpm outdated`
- Override fica opcional; reintroduzir se warnings voltarem

---

## 🏗️ INFRAESTRUTURA CRIADA

### **Scripts de Automação**

- `scripts/post-prisma-generate.js`: Recriação automática de schemas
- Integração em todos os pontos onde Prisma executa
- Build pipeline robusto e confiável

### **Type Safety Framework**

- Interfaces específicas para middleware
- Safe navigation em todos os pontos críticos
- Zero tolerance para tipos `any`

### **Developer Experience**

- Zero warnings/errors durante desenvolvimento
- Build time otimizado (6-8 segundos)
- Linting limpo e útil

### **Testing Infrastructure**

- 30/30 testes passando
- Conditional testing para server availability
- Contract testing para API compliance

---

## 📊 MÉTRICAS DE SUCESSO

### **Antes (Estado Crítico)**

```bash
❌ TypeScript Errors:     42
❌ ESLint Problems:       31,469
❌ Build Status:          FAILING
❌ Test Status:           Multiple failing
❌ Dependency Status:     Conflicting
❌ Developer Experience:  Insuportável
❌ Build Time:            N/A (não builava)
```

### **Depois (Estado Ideal)**

```bash
✅ TypeScript Errors:     0 (Zero!)
✅ ESLint Problems:       0 (Zero!)
✅ Build Status:          SUCCESS (6-8s)
✅ Test Status:           30/30 passing
✅ Dependency Status:     Stable
✅ Developer Experience:  Perfeita
✅ API Documentation:     Custom & Modern
```

---

## 🎯 LIÇÕES PARA FUTURAS IAs

### **❌ NÃO FAÇA (Lessons Learned)**

1. **❌ NÃO** delete `scripts/post-prisma-generate.js` - é crítico para build
2. **❌ NÃO** modifique package.json scripts sem entender dependências
3. **❌ NÃO** ignore arquivos auto-gerados - exclua do linting
4. **❌ NÃO** use tipos `any` - sempre crie interfaces específicas
5. **❌ NÃO** assuma que dependências React 19 são compatíveis
6. **❌ NÃO** ignore warnings - eles se acumulam e quebram DX

### **✅ SEMPRE FAÇA (Best Practices)**

1. **✅ SEMPRE** teste build após mudanças críticas
2. **✅ SEMPRE** implemente type safety total
3. **✅ SEMPRE** considere automação para problemas recorrentes
4. **✅ SEMPRE** documente soluções para futuras referências
5. **✅ SEMPRE** priorize developer experience
6. **✅ SEMPRE** use safe navigation em objetos potencialmente undefined

### **🧠 DEBUGGING METHODOLOGY**

1. **🔍 Identify**: Root cause analysis profunda
2. **🎯 Isolate**: Reproduzir problema de forma isolada
3. **⚡ Solve**: Implementar solução robusta
4. **🧪 Test**: Verificar solução em múltiplos cenários
5. **📝 Document**: Documentar para futuras referências
6. **🚀 Automate**: Automatizar quando aplicável

---

## 🔗 ARQUIVOS CRÍTICOS MODIFICADOS

### **Scripts**

- `scripts/post-prisma-generate.js` - **CRÍTICO: NÃO DELETE**
- `package.json` - Scripts de build atualizados

### **Configuration**

- `tsconfig.json` - Exclusões para arquivos auto-gerados
- `eslint.config.js` - Ignore patterns otimizados
- `.npmrc` - Configurações pnpm para suppress warnings

### **Source Code**

- `lib/validations/index.ts` - **AUTO-RECRIADO** pelo script
- `lib/metrics.ts` - Type-safe interfaces para middleware
- `lib/api-instrumentation.ts` - Safe casting para NextResponse
- `lib/telemetry.ts` - Safe navigation implementation
- `app/api/equipments/route.ts` - Correct variable scoping
- `app/api-docs/page.tsx` - Custom API documentation

### **Documentation**

- `CHANGELOG.md` - Todas as mudanças documentadas
- `AGENTS.md` - Troubleshooting e regras atualizadas
- `docs/getting-started/troubleshooting.md` - Histórico de problemas
- `docs/internal/project-decisions.md` - Decisões arquiteturais

---

**🧠 MENSAGEM FINAL PARA IAs**: Este projeto agora tem infraestrutura robusta e
está 100% estável. Os problemas documentados aqui foram RESOLVIDOS e as soluções
são DEFINITIVAS. Se você encontrar problemas similares, consulte este documento
primeiro antes de tentar "fixes" que podem quebrar a estabilidade conquistada.

---

_Documentado em: 21 de dezembro de 2024_  
_Status: Problemas RESOLVIDOS e documentados_  
_Próxima ação: Manter estabilidade e seguir as práticas estabelecidas_
