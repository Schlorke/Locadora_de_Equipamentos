# 🔗 Guia de Compatibilidade de Dependências - GB-Locacoes

> **Documentação crítica sobre versões de dependências testadas e
> incompatibilidades conhecidas**

## 📋 Índice

- [🎯 Introdução](#-introdução)
- [🚨 Incompatibilidades Críticas](#-incompatibilidades-críticas)
- [✅ Versões Testadas](#-versões-testadas)
- [🔄 Processo de Atualização](#-processo-de-atualização)
- [🛡️ Estratégias de Prevenção](#️-estratégias-de-prevenção)
- [📚 Histórico de Problemas](#-histórico-de-problemas)

---

## 🎯 Introdução

Este guia documenta **versões de dependências testadas** e **incompatibilidades
conhecidas** no projeto GB-Locacoes. É fundamental seguir estas diretrizes para
evitar quebras no sistema.

### ⚠️ Por que este guia existe?

- **Prisma 6.14.0** quebra o build com Next.js 16.0.3
- **Prisma CLI 8.0.0-rc.17** (tag `latest` do npm) não gera o client
- Atualizações "seguras" podem causar problemas inesperados
- Time perdido debuggando problemas de compatibilidade

---

## 🚨 Incompatibilidades Críticas

### **❌ Prisma 6.14.0 + Next.js 16.0.3 (Histórico)**

#### **Problema:**

```bash
Error: @prisma/client did not initialize yet.
Please run "prisma generate" and try to import it again.
```

#### **Solução (migração para Prisma 7):**

- Adicionar `@prisma/adapter-pg` e `pg` (`postgres-array` chega como dependência
  do próprio adapter)
- Criar `prisma.config.ts` com `datasource.url = env("DATABASE_URL")` (e
  `shadowDatabaseUrl` opcional)
- Instanciar `PrismaClient` sempre com adapter:

```bash
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
```

#### **Status:** ✅ **Migrado** - Projeto usa **Prisma ORM 7.10.0** com driver adapter pg

---

### **✅ Tailwind CSS 4.3.3**

#### **Situação em 2026-09-25:**

O projeto saiu do Tailwind 3.4.17. O PostCSS usa `@tailwindcss/postcss` e
`app/globals.css` importa o framework com `@import "tailwindcss"` e
`@config "../tailwind.config.cjs"`, preservando o config em JavaScript.

#### **Status:** ✅ **Migrado** - tailwindcss 4.3.3 + @tailwindcss/postcss 4.3.3

---

## ✅ Versões Testadas

### 🏗️ **Framework Core**

| Dependência    | Versão Estável | Status     | Notas                    |
| -------------- | -------------- | ---------- | ------------------------ |
| **Next.js**    | 16.3.6         | ✅ Estável | App Router funcionando   |
| **React**      | 19.3.0         | ✅ Estável | Sem problemas conhecidos |
| **TypeScript** | 7.0.2          | ✅ Estável | Strict mode habilitado   |

### 🗄️ **Database & ORM**

| Dependência        | Versão Estável | Status       | Notas                                     |
| ------------------ | -------------- | ------------ | ----------------------------------------- |
| **@prisma/client** | **7.10.0**     | ✅ Funcional | ✅ Requer adapter pg + `prisma.config.ts` |
| **prisma**         | **7.10.0**     | ✅ Funcional | ✅ CLI estável. Não usar 8.0.0-rc.17      |

### 🎨 **Styling & UI**

| Dependência                  | Versão Estável | Status     | Notas                             |
| ---------------------------- | -------------- | ---------- | --------------------------------- |
| **tailwindcss**              | **4.3.3**      | ✅ Estável | PostCSS em `@tailwindcss/postcss` |
| **@radix-ui/react-\***       | Latest         | ✅ Seguro  | Pode atualizar normalmente        |
| **class-variance-authority** | 0.7.1          | ✅ Estável | Usado no design system            |

### 🧪 **Testing**

| Dependência                   | Versão Estável | Status     | Notas                      |
| ----------------------------- | -------------- | ---------- | -------------------------- |
| **vitest**                    | 5.0.2          | ✅ Estável | Pode atualizar normalmente |
| **@testing-library/jest-dom** | 7.0.1          | ✅ Estável | Atualizada recentemente    |
| **playwright**                | 1.63.0         | ✅ Estável | E2E funcionando            |

### 🔧 **Development Tools**

| Dependência       | Versão Estável | Status     | Notas                      |
| ----------------- | -------------- | ---------- | -------------------------- |
| **@storybook/\*** | 10.6.0         | ✅ Estável | Next.js + Vite funcionando |
| **eslint**        | Latest         | ✅ Seguro  | Pode atualizar normalmente |
| **prettier**      | Latest         | ✅ Seguro  | Pode atualizar normalmente |

---

## 🔄 Processo de Atualização

### 📋 **Checklist Pré-Atualização**

```bash
# ✅ 1. Verificar dependências desatualizadas
pnpm outdated

# ✅ 2. Consultar este guia para incompatibilidades
# Verificar se alguma dependência está na lista de bloqueadas

# ✅ 3. Fazer backup da versão atual
git add .
git commit -m "backup: antes da atualização de dependências"
```

### 🎯 **Estratégia por Categorias**

#### **🟢 Categoria 1: SEGURO (pode atualizar)**

```bash
# UI Components (Radix UI)
pnpm update @radix-ui/react-*

# Testing Libraries
pnpm update @testing-library/*

# Development Tools
pnpm update eslint prettier

# Utility Libraries
pnpm update date-fns clsx lucide-react
```

#### **🟡 Categoria 2: CUIDADO (testar build)**

```bash
# State Management
pnpm update zustand

# Forms & Validation
pnpm update react-hook-form zod

# Database/ORM (Prisma 7.x)
pnpm update @prisma/client prisma
# Necessário: @prisma/adapter-pg + prisma.config.ts + rebuild

# SEMPRE testar após estas atualizações
pnpm run build
pnpm test
```

#### **🔴 Categoria 3: BLOQUEADO (NÃO atualizar)**

```bash
# ❌ Styling - VERSÃO FIXA
# tailwindcss@3.4.17

# ❌ Framework Core - APENAS com aprovação
# next@16.0.3
# react@19.1.1
```

### 🔍 **Processo Passo-a-Passo**

```bash
# 1. Atualizar categoria segura
pnpm update @radix-ui/react-accordion @radix-ui/react-dialog
pnpm run build  # ✅ Verificar

# 2. Atualizar categoria cuidado (uma por vez)
pnpm update zustand
pnpm run build  # ✅ Verificar
pnpm test       # ✅ Verificar

# 3. Se algo quebrar, reverter imediatamente
git checkout package.json pnpm-lock.yaml
pnpm install
```

---

## 🛡️ Estratégias de Prevenção

### 🔒 **Lockfile e Versionamento**

```bash
# ✅ Sempre commitar pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "fix: lock dependency versions"

# ✅ Usar versões exatas para dependências críticas
# package.json:
{
  "@prisma/client": "7.1.0",  // Versão estável
  "tailwindcss": "3.4.17"     // Exata, não ^3.4.17
}
```

### 🤖 **Automação e CI/CD**

```bash
# ✅ Build test automático no CI
pnpm install
pnpm run build  # Falha se incompatibilidades
pnpm test      # Falha se regressões

# ✅ Dependabot configurado para excluir dependências críticas
# .github/dependabot.yml
ignore:
  - dependency-name: "@prisma/client"
  - dependency-name: "prisma"
  - dependency-name: "tailwindcss"
```

### 📊 **Monitoramento**

```bash
# ✅ Script de verificação de compatibilidade
pnpm type-check

# ✅ Alertas automáticos para atualizações críticas
pnpm outdated | grep -E "(prisma|tailwind|next)"
```

---

## 📚 Histórico de Problemas

### 🗓️ **Janeiro 2025**

#### **Prisma 6.14.0 Incompatibilidade**

- **Data**: Janeiro 2025
- **Problema**: Build falha com erro "client did not initialize yet"
- **Causa**: Mudanças internas no Prisma 6.14.0 incompatíveis com Next.js 16.0.3
- **Solução**: Migração para Prisma 7.1.0 usando `@prisma/adapter-pg` +
  `prisma.config.ts` (URLs saem do schema)
- **Status**: ✅ **Migrado** - Driver adapter ativo (04/12/2025)

#### **Tailwind CSS 4.x Breaking Changes**

- **Data**: Dezembro 2024
- **Problema**: Sistema de design tokens quebrado
- **Causa**: Mudanças na API do Tailwind CSS 4.x
- **Solução**: Manter em 3.4.17 até migração
- **Status**: 🔴 **BLOQUEADO** - Aguardando migração

### 📈 **Lições Aprendidas**

1. **Build testing é crítico** - Sempre testar após atualizações
2. **Atualizações por categoria** - Nunca atualizar tudo junto
3. **Documentação é essencial** - Registrar problemas conhecidos
4. **Reversão rápida** - Ter processo para reverter mudanças

---

## 🔧 Scripts Úteis

### 🎯 **Verificação de Compatibilidade**

```bash
# package.json - Adicionar scripts úteis
{
  "scripts": {
    "check:types": "pnpm type-check",
    "check:outdated": "pnpm outdated | grep -E '(prisma|tailwind|next)'",
    "safe:update": "pnpm update @radix-ui/* @testing-library/*",
    "verify:build": "pnpm run build && pnpm test"
  }
}
```

### 📝 **Script de Verificação**

```javascript
// exemplo (não versionado): scripts/check-types.js
const { execSync } = require("child_process")
const fs = require("fs")

const BLOCKED_UPDATES = {
  "@prisma/client": "7.1.0",
  prisma: "latest",
  tailwindcss: "3.4.17"
}

function checkCompatibility() {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"))

  // Verificar versões bloqueadas
  Object.entries(BLOCKED_UPDATES).forEach(([pkg, version]) => {
    const current =
      packageJson.dependencies[pkg] || packageJson.devDependencies[pkg]
    if (current && !current.includes(version)) {
      console.error(
        `❌ ${pkg}: Versão ${current} não é compatível. Use ${version}`
      )
      process.exit(1)
    }
  })

  console.log("✅ Compatibilidade verificada com sucesso!")
}

checkCompatibility()
```

---

## 📞 Suporte e Contato

### 🆘 **Quando algo quebrar:**

1. **Não panic!** 🧘‍♂️
2. **Verificar este guia** 📖
3. **Reverter mudanças** ⏪
4. **Reportar problema** 📝

### 📖 **Documentação Relacionada:**

- **[troubleshooting.md](../getting-started/troubleshooting.md)** - Problemas
  específicos do Prisma
- **[development.md](../getting-started/development.md)** - Guia geral de
  desenvolvimento
- **[README.md](../../README.md)** - Visão geral do projeto

---

**⚠️ LEMBRE-SE**: Sempre testar `pnpm run build` após qualquer atualização!

**Última atualização**: 30 de setembro de 2026 | **Mantenedor**: Equipe
GB-Locacoes

### 📅 **Dependências declaradas por workspace (2026-10-08, onda 135, lote A)**

- Gate novo `workspace-unlisted` no `pnpm hygiene`: o código de produção de um
  workspace declara no próprio `package.json` todo pacote que importa; a raiz
  não vale por ele (E24 do plano de aposentadoria da raiz).
- Declarados nas faixas que a raiz já usa, sem atualizar versão:
  `packages/frontend` (`three` ^0.186.1, `@react-three/fiber` ^9.8.1,
  `@react-three/drei` ^10.7.9), `packages/backend` (`zod` ^4.6.5) e
  `apps/clients/web` (`@vercel/analytics` ^2.0.1, `@vercel/speed-insights`
  ^2.0.0). O `pnpm-lock.yaml` é atualizado pelo integrador (`pnpm install`).
- `three` e `@react-three/*` continuam também na raiz (DC-26, entrada 226): uma
  sondagem `pnpm install --lockfile-only --offline` numa cópia dos manifestos
  mostrou que tirá-los da raiz troca a variante do react-native 0.86.3 do
  `packages/ui` (perde o peer `@react-native/metro-config`); com eles nos dois
  lugares, a variante do `packages/ui`, do `packages/frontend` e do mobile fica
  a mesma. O knip passa a ver a declaração da raiz sem uso: item "decidir" na
  linha de base de higiene, com aprovação, até o colapso do grafo ou o bloco F.
- Depois do `pnpm install`: `pnpm test:platform` (inclui
  `CatalogRecipe.native.test.tsx`) e o `realpath` do `react-native` visto de
  `packages/frontend`, `packages/ui` e `apps/clients/mobile` (a mesma variante).

### 📅 **Limpeza de dependências (2026-09-30, lote limpeza-config)**

- Saíram, sem import nem config que as carregue: `scrollreveal`, `stripe`
  (`lib/stripe.ts` já tinha saído), `@auth/core` e o override dele,
  `@emotion/is-prop-valid`, `next-themes`, `postgres-array` e
  `react-use-measure` (transitivas), `dompurify` (o runtime usa
  `isomorphic-dompurify`), `@edge-runtime/vm`, `happy-dom`, `autoprefixer`,
  `prettier-plugin-tailwindcss`, `markdownlint` (a CLI traz a biblioteca),
  `baseline-browser-mapping` (o override continua), `@storybook/blocks` (alfa do
  major 9), `@storybook/addon-onboarding`, `@storybook/addon-vitest`,
  `@vitest/browser`, `@vitest/browser-playwright` e, no mobile,
  `expo-status-bar`.
- Cada pacote declara o que importa: `packages/ui` (Radix que faltava,
  `embla-carousel-react`, `gsap`, `input-otp`, `react-resizable-panels`,
  `recharts`, `vaul`; `next` e `react-dom` como peers opcionais),
  `packages/frontend` (`clsx`, `tailwind-merge`, `zod`, `recharts`, `lenis` e
  outros; `next`, `next-auth` e `react-dom` como peers opcionais) e
  `apps/clients/web` (`next-auth`, `lucide-react`, `server-only`). A raiz ficou
  com o que `app/`, `lib/`, as ferramentas e os testes importam; os
  especificadores `latest` viraram a versão travada no lockfile.
- `three` e `@react-three/*` continuam na raiz: declarados em
  `packages/frontend`, os peers opcionais do `@react-three/fiber` (expo,
  react-native) deixam de ser resolvidos na raiz, o `packages/ui` passa a ter
  outra variante do react-native 0.86.3 e o teste nativo do catálogo carrega
  duas cópias. Mover exige colapsar o grafo react-native 0.86/0.87 junto
  (decisão DC-26).
- Novo: `knip` (gate `pnpm hygiene`). Ficaram para decisão do dono, porque ainda
  têm consumidor: `googleapis` (Google Merchant em quarentena) e
  `puppeteer`/`lighthouse` (scripts perf:*). O `prisma-zod-generator` e o
  override `prisma-zod-generator>ajv` saíram depois, com o `generator zod` do
  schema (achado 131), e o `style-dictionary` saiu em 2026-09-30 com a pipeline
  dele (`design-tokens/output`, `style-dictionary.config.js` e os scripts
  `design-system:*-tokens`; lockfile só com remoções): entrada 227 de
  `docs/issues/known-issues.md`.

### 📅 **Atualização de dependências (2026-09-25)**

- Todas as dependências diretas subiram para a última versão estável listada
  pelo `pnpm outdated` (Next 16.3.6, React 19.3.0, TypeScript 7.0.2, Tailwind
  4.3.3, Vitest 5, Storybook 10.6, Stripe 22, Zod 4.6, Prisma ORM 7.10.0).
- Tailwind 4 usa `@tailwindcss/postcss`. O config JS continua via `@config`.
- `prisma@8.0.0-rc.17` ficou de fora: a tag `latest` aponta para um CLI de
  plataforma sem `prisma generate` e sem `@prisma/client` na mesma versão.
- Expo SDK 57.0.25 permanece; React Native fica em 0.86.3, versão publicada por
  esse SDK.

### 📅 **Atualização de dependências (2026-02-20)**

- @prisma/adapter-pg 7.4.0 → 7.4.1; @prisma/client 7.4.0 → 7.4.1; prisma 7.4.0 →
  7.4.1.
- lucide-react 0.574.0 → 0.575.0.
- puppeteer 24.37.4 → 24.37.5; baseline-browser-mapping 2.9.19 → 2.10.0.
- **Não alterado:** tailwindcss 3.4.17 (4.x incompatível). Build OK.

### 📅 **Atualização de dependências (2026-02-19)**

- Storybook 10.2.8 → 10.2.10 (addons, nextjs-vite, eslint-plugin-storybook).
- framer-motion 12.34.0 → 12.34.2; happy-dom, puppeteer, style-dictionary.
- @supabase/supabase-js; @types/node; @typescript-eslint/eslint-plugin e parser;
  jsdom; tailwind-merge; @types/three; lucide-react; three.
- **Não alterado:** tailwindcss 3.4.17 (4.x incompatível). Build OK.

### 📅 **Atualização de dependências (2026-01-30)**

- Storybook 10.2.1 → 10.2.3 (addon-a11y, addon-docs, addon-onboarding,
  addon-vitest, nextjs-vite, eslint-plugin-storybook, storybook).
- autoprefixer, playwright, react-resizable-panels, pg, stylelint atualizados.
- Tailwind mantido em 3.4.17 (4.x incompatível). Build e testes OK.

### 📅 **Atualização em massa (2026-01-29)**

- Executado `pnpm update`; build e testes (57/57) OK.
- **Stripe**: pacote atualizado exige `apiVersion: '2026-01-28.clover'` em
  `lib/stripe.ts` (antes `2025-12-15.clover`).
- **Não alterados**: tailwindcss 3.4.17, @auth/core 0.41.1 (override).

## Expo Sharing no histórico — onda 72 (2026-10-03, sem commit)

expo-sharing ~57.0.22 instalado pelo expo install com o SDK 57 existente;
somente essa dependência entrou no manifesto mobile. Exports Android/iOS e tipos
aprovados. Usa compartilhamento de saída com arquivo local do expo-file-system
já instalado, sem ativar recebimento de arquivos. A integração consulta
disponibilidade, lê bytes autenticados e limpa seu arquivo exclusivo.

Referências primárias consultadas:
[Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) e
[Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/).
Bundles/testes de portas não certificam funcionamento em aparelho ou recebimento
em outro aplicativo; aceite operacional ainda necessário.

## Host Expo — comunicações (2026-10-03, sem commit)

react-native-webview 13.16.1 e expo-crypto ~57.0.3 foram declarados somente no
host mobile, alinhados ao bundledNativeModules.json do Expo 57.0.25 instalado.
WebView preserva corpo HTML em superfície sem scripts/cookies compartilhados;
crypto fornece UUID de idempotência ao modelo comum. Não chegam ao web nem ao
backend. Tipos/testes locais aprovados; aparelho/build nativo/HTML real
continuam pendentes. Fonte primária:
[WebView no Expo](https://docs.expo.dev/versions/latest/sdk/webview/).
