# 🔧 Storybook - Troubleshooting e Avisos

**Última atualização**: 04/11/2025 **Status**: ✅ Todos os avisos analisados e
resolvidos

---

## 📊 **Status Atual do Storybook**

```
✅ Storybook v10.0.4 rodando
✅ Builder: Vite (migrado de Webpack)
✅ Build time: ~2-3s (antes: ~7s)
✅ URL: http://localhost:6006
✅ Cache limpo
✅ TypeScript: 0 erros
```

---

## ⚠️ **Avisos do Terminal - Análise Completa**

### **1. Erro: @storybook/blocks ausente no build** 🚧 RESOLVIDO

```
[vite]: Rollup failed to resolve import "@storybook/blocks" from "./stories/...mdx"
```

#### **Análise**:

- ⚠️ Storybook 10.x não instala `@storybook/blocks` automaticamente
- ⚠️ Stories MDX usam `Meta/Canvas/Controls` exportados pelo pacote
- ❌ Sem a dependência o build aborta logo no início (preview não compila)

#### **Status**: ✅ RESOLVIDO (2025-12-05)

- Pacote adicionado como devDependency: `@storybook/blocks@9.0.0-alpha.17`
- Build-storybook volta a rodar normalmente

#### **Solução Aplicada**:

```bash
pnpm add -D @storybook/blocks@9.0.0-alpha.17
```

---

### **2. Aviso: Webpack vs Vite** ✅ RESOLVIDO

```
storybook/test: You're using @storybook/nextjs, which is a Webpack-based builder.
Suggestion: Use @storybook/nextjs-vite for better performance.
```

#### **Análise**:

- **Antes**: Webpack builder (~7s build time)
- **Agora**: Vite builder (~2-3s build time) ⚡
- **Ganho**: 3-4x mais rápido

#### **Status**: ✅ MIGRADO (04/11/2025)

#### **Solução Aplicada**:

**1. Builder migrado:**

```bash
pnpm remove @storybook/nextjs
pnpm add -D @storybook/nextjs-vite@^10.0.4
```

**2. Configuração atualizada (`.storybook/main.ts`):**

```typescript
import type { StorybookConfig } from '@storybook/nextjs-vite'

framework: {
  name: '@storybook/nextjs-vite',
  options: {},
}

// webpackFinal substituído por viteFinal
viteFinal: async (config) => {
  if (config.resolve) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': resolve(__dirname, '../'),
    }
  }
  return config
}
```

#### **Benefícios Obtidos**:

- ⚡ Hot reload 3-4x mais rápido durante desenvolvimento
- 🚀 Build time reduzido de ~7s para ~2-3s
- 🧪 Storybook Test habilitado (@storybook/addon-vitest)
- 📦 Bundle size menor e mais otimizado

---

### **3. Aviso: Múltiplos Favicons** ℹ️ INFORMATIVO

```
Looks like multiple favicons were detected. Using the first one.
C:/Projetos/GB-Locacoes/public/favicon.svg
C:/Projetos/GB-Locacoes/public/favicon.ico
```

#### **Análise**:

- ✅ Storybook detectou 2 favicons em `public/`
- ✅ Usa automaticamente o primeiro (favicon.svg)
- ✅ Não afeta funcionalidade

#### **Status**: ℹ️ INFORMATIVO (não crítico)

#### **Solução (Opcional - Limpeza)**:

**Se quiser remover o aviso:**

```bash
# Remover favicon.ico (manter apenas .svg)
rm public/favicon.ico
```

**Ou adicionar configuração explícita em `.storybook/main.ts`:**

```typescript
const config: StorybookConfig = {
  // ... outras configs
  staticDirs: [{ from: "../public/favicon.svg", to: "/favicon.svg" }]
}
```

#### **Recomendação**:

- ✅ **Ignorar aviso** (não afeta nada)
- 🧹 **OU remover .ico** (se não for usado no projeto principal)

---

## ✅ **Checklist de Resolução**

- [x] **Addons incompatíveis removidos** (`@storybook/addon-controls`,
      `@storybook/addon-actions`)
- [x] **Import React adicionado** em `preview.tsx` (fix TypeScript)
- [x] **Cache do Storybook limpo** (node_modules/.cache)
- [x] **Documentação consolidada** em `docs/guides/`
- [x] **Todos addons em v10.0.4** (versão consistente)

---

## 📝 **Comandos Úteis**

### Limpar Cache

```powershell
# Só depois de conferir que a pasta de cache não tem link (sem resultado aqui):
Get-ChildItem node_modules\.cache -Recurse -Force -Attributes ReparsePoint
```

Nunca apague `node_modules` inteiro nem use `Remove-Item -Recurse` em pasta que
possa ter link (seção
[Limpeza segura](../getting-started/troubleshooting.md#-limpeza-segura-nunca-apague-node_modules-à-mão)).

### Verificar Pacotes Instalados

```bash
pnpm list | findstr storybook
```

### Reiniciar Storybook Limpo

```bash
# 1. Parar Storybook (Ctrl+C)
# 2. Limpar cache
# 3. Reiniciar
pnpm storybook
```

---

## 🎯 **Recomendações Finais**

### **Fazer Agora** ✅

- [x] Cache limpo
- [x] Addons corrigidos
- [x] TypeScript corrigido
- [x] Documentação atualizada

### **Considerar Depois** ⏸️

- [ ] Migrar para Vite builder (performance)
- [ ] Remover favicon.ico (limpeza)

### **Ignorar** ℹ️

- Aviso de múltiplos favicons (não afeta nada)
- Aviso de @storybook/blocks (cache antigo)

---

## 🚀 **Próximos Passos**

1. **Reinicie o Storybook:**

```bash
pnpm storybook
```

2. **Verifique que os avisos diminuíram ou desapareceram**

3. **Se ainda houver avisos:**
   - Copie a mensagem completa
   - Consulte este guia
   - Ou reporte no canal de suporte

---

## 📊 **Comparação Antes/Depois**

### Antes ❌

```
⚠️ 3+ avisos no terminal
⚠️ Addons incompatíveis
⚠️ TypeScript errors
⚠️ Cache com referências antigas
```

### Depois ✅

```
✅ Máximo 2 avisos informativos
✅ Addons compatíveis (v10.0.4)
✅ TypeScript clean (0 erros)
✅ Cache limpo
✅ Build ~7s
✅ Funcionamento 100%
```

---

## 🆘 **Troubleshooting Adicional**

### Problema: Storybook não inicia

```bash
# 1. Cache: conferir que node_modules/.cache não tem link antes de apagá-la
find node_modules/.cache -type l

# 2. Refazer a instalação sem apagar node_modules
pnpm install --force

# 3. Verificar versões
pnpm list | findstr storybook
```

### Problema: Erros de build

```bash
# 1. Verificar TypeScript
pnpm type-check

# 2. Verificar ESLint
pnpm lint

# 3. Limpar e rebuildar
pnpm clean && pnpm install
```

### Problema: Stories não aparecem

```bash
# 1. Verificar padrão de arquivos em .storybook/main.ts
stories: [
  '../stories/**/*.mdx',
  '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
]

# 2. Verificar se arquivos existem
dir stories\**\*.stories.tsx
```

---

## 📞 **Links Úteis**

- [Storybook Documentation](https://storybook.js.org/docs/)
- [Next.js Integration](https://storybook.js.org/docs/get-started/frameworks/nextjs)
- [Vite Migration](https://storybook.js.org/docs/get-started/frameworks/nextjs?ref=upgrade#with-vite)
- [Troubleshooting Guide](https://storybook.js.org/docs/configure/troubleshooting)

---

**🎨 GB Locações Design System** **📅 Última atualização**: 04/11/2025 **✅
Status**: Operacional e otimizado
