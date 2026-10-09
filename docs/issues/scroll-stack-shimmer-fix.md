# ScrollStack - Correção do Tremor/Balanço (Jan 2025)

## 🐛 Problema Identificado

### Sintomas

Cards do `ScrollStack` na seção "Why Choose Us" apresentavam tremor/balanço
vertical durante o scroll:

- ❌ Cards já empilhados "balançavam" para cima e para baixo
- ❌ Movimento brusco a cada evento de scroll do mouse
- ❌ Desconforto visual e vertigem, especialmente em mobile
- ❌ Comportamento diferente da demo original em ReactBits.dev

### Causa Raiz

**Implementação atual**: Não usava Lenis smooth scroll

- Scroll nativo do browser → atualizações bruscas e diretas
- `requestAnimationFrame` chamado manualmente no `handleScroll`
- Sem interpolação entre frames
- Resultado: transições abruptas causando "tremor"

**Implementação de referência**: Usava Lenis smooth scroll

- Sistema de interpolação (`lerp: 0.1`) suaviza transições
- Loop RAF gerenciado internamente pelo Lenis
- Movimento fluido sem tremores

## ✅ Solução Implementada

### 1. Integração do Lenis

Adicionado Lenis ao componente `ScrollStack`:

```typescript
import Lenis from "lenis"

const setupLenis = useCallback(() => {
  if (useWindowScroll) {
    // Modo: scroll da janela
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
      infinite: false,
      wheelMultiplier: 1,
      lerp: 0.1, // ⭐ Interpolação que resolve o tremor
      syncTouch: true,
      syncTouchLerp: 0.075
    })

    lenis.on("scroll", handleScroll)

    const raf = (time: number) => {
      lenis.raf(time)
      rafRef.current = requestAnimationFrame(raf)
    }
    rafRef.current = requestAnimationFrame(raf)

    lenisRef.current = lenis
    return lenis
  }
  // ... modo container
}, [handleScroll, useWindowScroll])
```

### 2. Parâmetros Críticos do Lenis

| Parâmetro            | Valor    | Função                                         |
| -------------------- | -------- | ---------------------------------------------- |
| `lerp`               | 0.1      | **Interpolação** - suaviza transições (0-1)    |
| `duration`           | 1.2      | Duração suave do scroll (segundos)             |
| `easing`             | Custom   | Curva de suavização otimizada                  |
| `smoothWheel`        | true     | Ativa smooth scroll para mouse wheel           |
| `syncTouch`          | true     | Sincroniza smooth scroll com touch             |
| `syncTouchLerp`      | 0.075    | Interpolação para touch (mais suave que wheel) |
| `touchMultiplier`    | 2        | Sensibilidade do touch                         |
| `wheelMultiplier`    | 1        | Sensibilidade do wheel                         |
| `gestureOrientation` | vertical | Direção do gesto (apenas para modo container)  |

### 3. Mudanças no Lifecycle

**Antes (sem Lenis)**:

```typescript
useLayoutEffect(() => {
  // ...
  const scrollTarget = useWindowScroll ? window : scroller
  if (scrollTarget) {
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true })
  }
  // ...
  return () => {
    if (scrollTarget) {
      scrollTarget.removeEventListener("scroll", handleScroll)
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
  }
}, [dependencies])
```

**Depois (com Lenis)**:

```typescript
useLayoutEffect(() => {
  // ...
  // Inicializa o Lenis
  setupLenis()

  // Primeira atualização
  updateCardTransforms()

  // Cleanup
  return () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    if (lenisRef.current) {
      lenisRef.current.destroy() // ⭐ Cleanup do Lenis
    }
    // ...
  }
}, [dependencies])
```

### 4. Arquivos Criados/Modificados

#### Modificados

- ✅ `components/ui/scroll-stack.tsx` - Adicionado Lenis
- ✅ `docs/features/scroll-stack.md` - Documentação atualizada
- ✅ `CHANGELOG.md` - Entry sobre a correção

#### Criados

- ✅ `types/lenis.d.ts` - Definições TypeScript completas (removido depois: o
  pacote `lenis` 1.3 traz os próprios tipos em `dist/lenis.d.ts`)
- ✅ `docs/issues/scroll-stack-shimmer-fix.md` - Este documento

## 📊 Comparação Antes vs Depois

| Aspecto            | Antes ❌               | Depois ✅                   |
| ------------------ | ---------------------- | --------------------------- |
| **Smooth Scroll**  | Não                    | Sim (Lenis)                 |
| **Interpolação**   | Não                    | Sim (`lerp: 0.1`)           |
| **Tremor/Balanço** | Presente               | Eliminado                   |
| **Mobile**         | Pior (vertigem)        | Suave                       |
| **Performance**    | 60fps (com tremores)   | 60fps (suave)               |
| **RAF Loop**       | Manual no handleScroll | Gerenciado pelo Lenis       |
| **Easing**         | Linear                 | Customizado                 |
| **Touch Support**  | Básico                 | Otimizado (`syncTouchLerp`) |

## 🧪 Como Testar

### 1. Verificar Importação

```bash
grep -r "import Lenis" components/ui/scroll-stack.tsx
# Deve retornar: import Lenis from 'lenis'
```

### 2. Verificar Lenis Instalado

```bash
grep "lenis" package.json
# Deve retornar: "lenis": "1.3.15"
```

### 3. Testar Visualmente

1. Acesse a página: http://localhost:3000
2. Navegue até a seção "Why Choose Us"
3. Use o scroll do mouse (wheel) para rolar
4. Observe os cards empilhados:
   - ✅ Devem permanecer **fixos** sem tremer
   - ✅ Movimento deve ser **suave** e **fluido**
   - ✅ Sem balanço vertical nos cards antigos

### 4. Testar em Mobile

1. Abra DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Selecione iPhone 12 Pro ou similar
4. Teste scroll com touch:
   - ✅ Movimento ainda mais suave (`syncTouchLerp: 0.075`)
   - ✅ Sem vertigem ou desconforto visual

## 🔧 Troubleshooting

### Erro: "Cannot find module 'lenis'"

```bash
pnpm install lenis
# ou
npm install lenis
```

### TypeScript Errors

Se houver erros de tipo do Lenis:

```bash
# Os tipos vêm do próprio pacote lenis (dist/lenis.d.ts); não há declaração local
ls packages/frontend/node_modules/lenis/dist/lenis.d.ts

# Se faltar, reinstale as dependências e confira os tipos do frontend
pnpm install
pnpm exec tsc -p packages/frontend/tsconfig.json --noEmit
```

### Lenis não está suavizando

Verifique se o Lenis foi inicializado:

```typescript
console.log("Lenis ref:", lenisRef.current) // Deve mostrar a instância Lenis
```

### Cards ainda tremem

1. Limpe o cache do browser (Ctrl+Shift+R)
2. Verifique se não há CSS conflitante:
   ```css
   /* Remova se existir */
   body {
     scroll-behavior: smooth !important;
   }
   ```
3. Certifique-se que o Lenis está rodando:
   ```typescript
   lenisRef.current.start() // Se necessário
   ```

## 📚 Referências

- **Lenis Documentation**: https://lenis.studiofreight.com/
- **ReactBits ScrollStack**: https://reactbits.dev/components/scroll-stack
- **ScrollStack Original Repo**: Baixado e analisado para esta correção
- **Implementação de Referência**: `ScrollStack-Component-Reutilizavel/`

## 🎯 Conclusão

A integração do **Lenis smooth scroll** resolveu completamente o problema de
tremor/balanço nos cards do ScrollStack. O componente agora funciona
perfeitamente, com movimento suave e fluido, idêntico à implementação de
referência do ReactBits.dev.

**Status**: ✅ **RESOLVIDO** (Jan 2025)

**Impacto**: Melhoria crítica na experiência do usuário, especialmente em
dispositivos móveis.

---

_Última atualização: Janeiro 2025 | Versão: 1.0.0_
