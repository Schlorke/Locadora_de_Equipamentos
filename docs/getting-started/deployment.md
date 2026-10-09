# 🚀 Deploy e Produção - GB Locações

> **Guia completo para deploy e configuração de produção do projeto
> GB-Locações**

Este guia descreve o host legado. A migração para os três hosts está em
[aceite da API compartilhada](../guides/shared-api-acceptance.md); o ensaio
local não autoriza implantação ou outra agenda. O destino Git autorizado é
Schlorke/Locadora_de_Equipamentos; o repositório GB-Locações permanece
referência legada e não deve receber publicação deste projeto. O corte de
produção para os hosts novos (projetos API, web e `fallback-raiz`, agendas e
variáveis) está no
[runbook do corte](../operations/runbook-corte-raiz-legada.md), com o
[manifesto de variáveis](../operations/manifesto-variaveis.md).

## 📋 Índice

- [🎯 Visão Geral](#-visão-geral)
- [☁️ Deploy na Vercel](#️-deploy-na-vercel)
- [🐳 Deploy com Docker](#-deploy-com-docker)
- [🔧 Configuração de Produção](#-configuração-de-produção)
- [📊 Monitoramento](#-monitoramento)
- [🛡️ Segurança](#️-segurança)
- [🔄 CI/CD](#-cicd)

---

## 🎯 Visão Geral

Este guia fornece instruções completas para deploy e configuração de produção do
projeto GB-Locações.

### 🎯 Objetivos

- **Deploy Automatizado** - CI/CD pipeline completo
- **Performance Otimizada** - Core Web Vitals excelentes
- **Segurança Robusta** - Headers e validações adequadas
- **Monitoramento Completo** - Analytics e logs estruturados
- **Escalabilidade** - Preparado para crescimento

---

## ☁️ Deploy na Vercel

### 🚀 Deploy Automático (Recomendado)

#### **1. Conectar Repositório**

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com GitHub
3. Clique em **"New Project"**
4. Selecione o repositório `Schlorke/Locadora_de_Equipamentos`
5. Configure as variáveis de ambiente

#### **2. Configuração do Projeto**

O projeto já está configurado com `vercel.json` otimizado:

```json
{
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install --frozen-lockfile=false",
  "framework": "nextjs",
  "images": {
    "formats": ["image/avif", "image/webp"],
    "sizes": [16, 32, 48, 64, 96, 128, 256, 384, 512, 1024, 2048]
  }
}
```

#### **3. Variáveis de Ambiente de Produção**

Configure as seguintes variáveis no painel da Vercel:

```bash
# =================================================================
# 🗄️ DATABASE (PRODUÇÃO)
# =================================================================
DATABASE_URL="postgresql://user:pass@host:port/db?schema=public"
DIRECT_URL="postgresql://user:pass@host:port/db?schema=public"

# =================================================================
# ☁️ SUPABASE (PRODUÇÃO)
# =================================================================
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# =================================================================
# 🔑 NEXTAUTH (PRODUÇÃO)
# =================================================================
NEXTAUTH_URL="https://locacoesgb.com.br"
NEXTAUTH_SECRET="your-production-secret-256-bits"

# =================================================================
# 💳 PAGAMENTOS (PRODUÇÃO)
# =================================================================
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
MERCADO_PAGO_TOKEN="your-production-token"

# =================================================================
# 📧 EMAIL (PRODUÇÃO)
# =================================================================
RESEND_API_KEY="your-production-resend-key"
SENDGRID_API_KEY="your-production-sendgrid-key"

# =================================================================
# 📄 CONTRATOS & 🚚 LOGÍSTICA
# =================================================================
ZAPSIGN_TOKEN="your-production-zapsign-token"
MELHOR_ENVIO_TOKEN="your-production-melhor-envio-token"

# =================================================================
# 🔍 LOGS & MONITORING
# =================================================================
LOG_LEVEL="info"
NODE_ENV="production"
```

#### **4. Deploy**

```bash
# Automático via Git
git push origin main
# Deploy é executado automaticamente

# Manual via CLI (opcional)
npx vercel --prod
```

### 🔧 **Configurações Específicas da Vercel**

#### **Build & Output Settings**

```bash
# Framework Preset: Next.js
# Build Command: pnpm run build
# Output Directory: .next
# Install Command: pnpm install
# Development Command: pnpm dev
```

#### **Function Configuration**

```json
// vercel.json (funções)
{
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

---

## 🐳 Deploy com Docker

### **Docker Compose (Recomendado)**

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: gblocacoes
      POSTGRES_USER: gblocacoes
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  postgres_data:
```

### **Deploy Docker**

```bash
# Build e deploy
docker-compose -f docker-compose.prod.yml up --build -d

# Verificar status
docker-compose ps

# Logs
docker-compose logs -f app
```

---

## 🔧 Configuração de Produção

### **1. Banco de Dados**

#### **Supabase (Recomendado)**

> **⚠️ CRÍTICO**: Para aplicações serverless (Vercel), use **Transaction Pooler
> (porta 6543)** conforme recomendação oficial do Supabase e Prisma.

```bash
# 1. Criar projeto no Supabase
# 2. Configurar variáveis (ver abaixo)
# 3. Executar migrations (RLS, grants e triggers vivem nelas; nunca db push)
pnpm exec prisma migrate deploy
pnpm db:seed
```

#### **Configuração de Connection Strings (Supabase + Prisma)**

**✅ PRODUÇÃO (Serverless - Vercel):**

```bash
# ✅ Transaction Pooler (porta 6543) - RECOMENDADO oficialmente
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=15"

# ✅ Direct Connection (porta 5432) - Para migrations
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

**✅ DESENVOLVIMENTO LOCAL:**

```bash
# ✅ Direct Connection (mais rápido para desenvolvimento)
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

**📚 Referências Oficiais:**

- [Supabase: Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma: Supabase Integration](https://www.prisma.io/docs/orm/overview/databases/supabase)
- [Supabase: Prisma Guide](https://supabase.com/docs/guides/database/prisma)

#### **PostgreSQL Self-hosted**

```bash
# Configuração de produção
# postgresql.conf
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

### **2. Otimizações de Performance**

#### **Next.js Config**

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Otimizações de produção
  compress: true,
  poweredByHeader: false,

  // Otimização de imagens
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000 // 1 ano
  },

  // Headers de segurança
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block"
          }
        ]
      }
    ]
  }
}

export default nextConfig
```

### **3. Caching Strategy**

```typescript
// Cache headers por tipo de conteúdo
const cacheHeaders = {
  "text/html": "public, max-age=0, must-revalidate",
  "text/css": "public, max-age=31536000, immutable",
  "application/javascript": "public, max-age=31536000, immutable",
  "image/*": "public, max-age=31536000, immutable"
}
```

---

## 📊 Monitoramento

### **1. Vercel Analytics**

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### **2. Logging Estruturado**

```typescript
// lib/logger.ts (produção)
import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty" }
})

// Uso em APIs
logger.info("User authenticated", {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString()
})
```

### **3. Health Checks**

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma")

    // Verificar banco
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    })
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: error.message },
      { status: 503 }
    )
  }
}
```

---

## 🛡️ Segurança

### **1. Headers de Segurança**

```typescript
// proxy.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // CSP
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  )

  return response
}
```

### **2. Rate Limiting**

```typescript
// lib/rate-limit.ts
import { NextRequest } from "next/server"

const rateLimitMap = new Map()

export function rateLimit(request: NextRequest, limit = 100) {
  const ip = request.ip ?? "127.0.0.1"
  const key = `${ip}:${Date.now()}`

  const requests = rateLimitMap.get(ip) || []
  const now = Date.now()
  const windowStart = now - 60 * 1000 // 1 minute window

  const requestsInWindow = requests.filter((time) => time > windowStart)

  if (requestsInWindow.length >= limit) {
    return false
  }

  requestsInWindow.push(now)
  rateLimitMap.set(ip, requestsInWindow)
  return true
}
```

### **3. Validação de Entrada**

```typescript
// Sempre usar Zod para validação
import { z } from "zod"

const apiSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email()
    // Sanitização automática
  })
  .strict() // Rejeitar campos extras
```

---

## 🔄 CI/CD

### **GitHub Actions**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: "--prod"
```

### **Deploy Checklist**

```bash
# ✅ Pré-deploy checklist
pnpm test                    # Testes passando
pnpm type-check              # TypeScript OK
pnpm lint                    # Linting OK
pnpm build                   # Build sucesso
pnpm type-check             # Tipos TypeScript OK

# ✅ Pós-deploy checklist
curl https://your-domain.com/api/health  # Health check
# Verificar métricas no Vercel
# Testar funcionalidades críticas
```

---

## 🚨 Troubleshooting de Produção

### **Problemas Comuns**

#### **1. Build Timeout na Vercel**

```bash
# Solução: Otimizar build
# package.json
{
  "scripts": {
    "build": "next build",
    "postbuild": "node scripts/patch-prisma.js"
  }
}
```

#### **2. Memory Limit Exceeded**

```bash
# Solução: Aumentar limit Node.js
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

#### **3. Prisma Connection Issues**

```typescript
// lib/prisma.ts (produção)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : ["error"]
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

---

## 📈 Performance Checklist

### **Core Web Vitals**

- [ ] **LCP** < 2.5s
- [ ] **FID** < 100ms
- [ ] **CLS** < 0.1

### **Otimizações**

- [ ] Imagens otimizadas (WebP/AVIF)
- [ ] Code splitting implementado
- [ ] Lazy loading em componentes
- [ ] CDN configurado
- [ ] Compression habilitada
- [ ] Cache headers configurados

---

_Última atualização: dezembro 2024_

---

## 🔗 Links Relacionados

- **[installation.md](./installation.md)** - Setup inicial
- **[development.md](./development.md)** - Desenvolvimento
- **[troubleshooting.md](./troubleshooting.md)** - Solução de problemas
