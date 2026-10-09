# 🔒 Análise de Alertas de Segurança - Janeiro 2025

> **Data**: 17 de Janeiro de 2025 **Status**: 🔴 5 alertas ativos
> **Prioridade**: Alta - Correções de segurança críticas

---

## 📋 Resumo Executivo

Este documento analisa **5 alertas de segurança** detectados pelo Dependabot em
dependências **transitivas** (indiretas) do projeto GB-Locações.

### 🎯 Status Geral

| Categoria     | Quantidade | Status                               |
| ------------- | ---------- | ------------------------------------ |
| **SvelteKit** | 2 alertas  | ⚠️ Vulnerável                        |
| **Hono**      | 2 alertas  | ⚠️ Vulnerável (DEV only)             |
| **Svelte**    | 1 alerta   | ⚠️ Vulnerável                        |
| **Undici**    | 0 alertas  | ✅ Resolvido (removido @vercel/blob) |

---

## 1. 🚨 SvelteKit - Vulnerabilidades SSRF/DoS (#15 e #14)

### 📦 Informações da Dependência

- **Pacote**: `@sveltejs/kit`
- **Versão Atual**: `2.49.2` (via `@vercel/analytics` e
  `@vercel/speed-insights`)
- **Versão Segura**: `>=2.49.5`
- **Tipo**: Dependência transitiva (peer dependency)
- **Caminho**: `@vercel/analytics` → `@sveltejs/kit`

### ⚠️ Vulnerabilidades

#### **Alert #15: SSRF/DoS em Prerendering**

- **CVE**: Não especificado
- **Severidade**: Alta
- **Impacto**:
  - **DoS**: Processo do servidor pode terminar
  - **SSRF**: Acesso a serviços internos sem autenticação
  - **XSS via Cache Poisoning**: Possível via envenenamento de cache CDN

**Condições de Exploração**:

- ✅ Aplicação tem pelo menos 1 rota prerenderizada
  (`export const prerender = true`)
- ⚠️ Usando `adapter-node` sem variável `ORIGIN` configurada
- ⚠️ Sem reverse proxy com validação de Host header

#### **Alert #14: Memory Amplification DoS**

- **CVE**: Não especificado
- **Severidade**: Média-Alta
- **Impacto**: Exaustão de memória via deserialização de dados binários

**Condições de Exploração**:

- ⚠️ Aplicação tem `experimental.remoteFunctions` habilitado
- ⚠️ Endpoint Remote Form acessível publicamente

### 🔍 Análise de Risco para o Projeto

#### **🚦 Risco Real: BAIXO**

**Razões**:

1. **Projeto usa Next.js, NÃO SvelteKit**:
   - `@sveltejs/kit` é apenas peer dependency do `@vercel/analytics`
   - Não há código SvelteKit rodando em produção
   - Vercel Analytics não usa funcionalidades vulneráveis

2. **Prerendering não é usado**:
   - Projeto Next.js não usa `export const prerender = true` (sintaxe SvelteKit)
   - Next.js usa `export const dynamic` ou `generateStaticParams` (sintaxe
     diferente)

3. **Remote Functions não habilitadas**:
   - Feature experimental do SvelteKit não existe no Next.js

### ✅ Recomendação

**AÇÃO**: Atualizar dependências do Vercel (esperar atualizações que fixem peer
dependency)

```bash
# Quando Vercel atualizar @sveltejs/kit para >=2.49.5
pnpm update @vercel/analytics @vercel/speed-insights
```

**PRIORIDADE**: 🟡 Média (risco baixo devido ao uso indireto)

---

## 2. 🔐 Hono - JWT Algorithm Confusion (#12 e #11)

### 📦 Informações da Dependência

- **Pacote**: `hono`
- **Versão Atual**: `4.10.6` (via `@prisma/dev`)
- **Versão Segura**: `>=4.11.4`
- **Tipo**: Dependência transitiva (apenas em DEV)
- **Caminho**: `@prisma/dev` → `@hono/node-server` → `hono`

### ⚠️ Vulnerabilidades

#### **Alert #12: JWT Algorithm Confusion (JWK/JWKS)**

- **Severidade**: Alta
- **Impacto**: Possível bypass de autenticação/autorização via tokens JWT
  forjados

**Condições de Exploração**:

- ⚠️ Usando middleware `jwk()` ou `jwks()` do Hono
- ⚠️ JWK não especifica campo `alg` explicitamente
- ⚠️ Middleware cai para `alg` do header JWT (não confiável)

#### **Alert #11: JWT Algorithm Confusion (Default HS256)**

- **Severidade**: Alta
- **Impacto**: Mesmo que #12, mas com fallback para HS256

### 🔍 Análise de Risco para o Projeto

#### **🚦 Risco Real: MUITO BAIXO (quase ZERO)**

**Razões**:

1. **Hono é usado APENAS em DEV**:
   - Dependência via `@prisma/dev` (ferramentas de desenvolvimento)
   - **NÃO** está em `dependencies`, apenas em `devDependencies`
   - **NÃO** roda em produção

2. **Projeto usa NextAuth.js, NÃO Hono JWT**:
   - Autenticação JWT é feita via `next-auth` (`lib/auth.ts`)
   - Nenhum código usa middleware JWT do Hono
   - Hono é apenas dependência interna do Prisma para dev tools

3. **Prisma Dev Tools não expõem JWT**:
   - `@prisma/dev` é usado para desenvolvimento local
   - Não expõe endpoints JWT públicos

### ✅ Recomendação

**AÇÃO**: Aguardar atualização do Prisma (quando atualizar `@prisma/dev` para
versão com `hono >=4.11.4`)

```bash
# Verificar atualizações do Prisma
pnpm outdated prisma @prisma/client

# Quando Prisma atualizar @prisma/dev com hono >=4.11.4
pnpm update prisma @prisma/client
```

**PRIORIDADE**: 🟢 Baixa (risco zero em produção)

---

## 3. 🎨 Svelte - Cross-Site Scripting (XSS) (#17)

### 📦 Informações da Dependência

- **Pacote**: `svelte`
- **Versão Atual**: `5.46.1` (via `@sveltejs/kit`)
- **Versão Segura**: `>=5.46.4`
- **Tipo**: Dependência transitiva (peer dependency)
- **Caminho**: `@sveltejs/kit` → `svelte`

### ⚠️ Vulnerabilidade

- **CVE**: Não especificado
- **Severidade**: Alta
- **Impacto**: Execução arbitrária de JavaScript no navegador do cliente

**Condições de Exploração**:

- ⚠️ Feature `experimental.async` habilitada
- ⚠️ Uso de `hydratable()` com chaves que incorporam input não confiável de
  usuário
- ⚠️ Chave quebrada é embedada em `<script>` sem escape

### 🔍 Análise de Risco para o Projeto

#### **🚦 Risco Real: BAIXO**

**Razões**:

1. **Svelte não é usado diretamente no projeto**:
   - Apenas peer dependency do `@sveltejs/kit`
   - Projeto usa React/Next.js, não Svelte

2. **Feature experimental não usada**:
   - `experimental.async` não existe no Next.js
   - `hydratable()` não é usado no projeto

3. **Sem código Svelte em produção**:
   - Todo código é React/TypeScript
   - Svelte não executa em runtime do projeto

### ✅ Recomendação

**AÇÃO**: Mesma do SvelteKit - atualizar dependências do Vercel

```bash
# Quando Vercel atualizar @sveltejs/kit (que atualizará svelte para >=5.46.4)
pnpm update @vercel/analytics @vercel/speed-insights
```

**PRIORIDADE**: 🟡 Média (risco baixo devido ao uso indireto)

---

## 4. ✅ Undici - Unbounded Decompression Chain (#13) (RESOLVIDO)

### 📦 Informações da Dependência

- **Pacote**: `undici`
- **Versão Atual**: N/A (dependência removida)
- **Versão Segura**: `>=6.23.0`
- **Tipo**: Dependência transitiva
- **Caminho**: `@vercel/blob` → `undici` (removido)

### ✅ Solução Aplicada

- `@vercel/blob` foi removido por não estar sendo utilizado no projeto.
- A remoção elimina a dependência transitiva do `undici` vulnerável.

### ✅ Status Atual

- **Alert #13**: Resolvido (dependência removida)

---

## 📊 Tabela Resumo de Prioridades

| Alert    | Pacote          | Versão          | Prioridade   | Risco Real | Ação                                              |
| -------- | --------------- | --------------- | ------------ | ---------- | ------------------------------------------------- |
| #15, #14 | `@sveltejs/kit` | 2.49.2 → 2.49.5 | 🟡 Média     | Baixo      | Aguardar Vercel                                   |
| #12, #11 | `hono`          | 4.10.6 → 4.11.4 | 🟢 Baixa     | Zero       | Aguardar Prisma                                   |
| #17      | `svelte`        | 5.46.1 → 5.46.4 | 🟡 Média     | Baixo      | Aguardar Vercel                                   |
| #13      | `undici`        | 5.29.0 → 6.23.0 | ✅ Resolvido | N/A        | Removido @vercel/blob (dependência não utilizada) |

---

## 🎯 Plano de Ação Recomendado

### **Fase 1: Imediata (Esta Semana)**

1. **Monitorar atualizações**:

   ```bash
   pnpm outdated @vercel/analytics @vercel/speed-insights
   ```

2. **Remoção aplicada (concluído)**:
   - `@vercel/blob` removido (dependência não utilizada), eliminando o alerta
     #13.

### **Fase 2: Curto Prazo (Próximas 2 Semanas)**

3. **Atualizar Vercel packages** quando disponíveis:

   ```bash
   pnpm update @vercel/analytics @vercel/speed-insights
   pnpm run build
   pnpm test
   ```

4. **Verificar atualizações do Prisma**:
   ```bash
   pnpm outdated prisma @prisma/client
   # Atualizar quando hono >=4.11.4 disponível
   ```

### **Fase 3: Monitoramento Contínuo**

5. **Configurar Dependabot** para auto-merge (opcional):
   - Apenas para patch versions
   - Após testes CI/CD passarem

6. **Documentar** atualizações no CHANGELOG.md

---

## ⚠️ Notas Importantes

### **🔴 NÃO FAZER**

- ❌ **NÃO** atualizar dependências manualmente via `package.json` para forçar
  versões
- ❌ **NÃO** usar `pnpm overrides` para resolver problemas transitivos (pode
  quebrar)
- ❌ **NÃO** ignorar alertas do Dependabot sem análise

### **✅ FAZER**

- ✅ Monitorar atualizações das dependências diretas
- ✅ Testar build após cada atualização
- ✅ Documentar mudanças no CHANGELOG.md
- ✅ Verificar se dependências transitivas foram atualizadas

---

## 🔗 Referências

- [GitHub Security Advisories](https://github.com/advisories)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [npm Security Best Practices](https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json#security)

---

**Última atualização**: 17 de janeiro de 2026 **Mantenedor**: Equipe GB-Locações
**Status**: 🔴 Monitorando atualizações das dependências diretas (5 alertas
ativos)
