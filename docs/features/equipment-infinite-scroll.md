# ♾️ EquipmentInfiniteScroll Component

> **Caminhos atuais (conferidos em 2026-09-30)**: o componente está em
> `packages/frontend/src/widgets/home-cliente/ui/ScrollInfinito.web.tsx`;
> `components/equipment-infinite-scroll` é o caminho antigo.

> **Status**: ✅ Implementado e Funcional (Novembro 2025) **Localização**:
> `packages/frontend/src/widgets/home-cliente/ui/ScrollInfinito.web.tsx`
> **Tipo**: Componente de Showcase Interativo

## 📋 Visão Geral

O `EquipmentInfiniteScroll` é um componente de scroll infinito horizontal que
exibe equipamentos em movimento contínuo. Possui duas linhas que se movem em
direções opostas, criando um efeito visual dinâmico e moderno para showcase de
produtos.

## 🎯 Características Principais

### **Animação**

- ✅ **Scroll Infinito**: Movimento contínuo sem interrupção
- ✅ **Duas Direções**: Linha 1 (→←) e Linha 2 (←→)
- ✅ **Loop Seamless**: Transição perfeita ao repetir
- ✅ **Performance**: GSAP com otimização GPU
- ✅ **Velocidade Constante**: 40s por ciclo completo

### **Design**

- ✅ **Identidade Visual**: Cores brancas e slate seguindo o projeto
- ✅ **Cards Elegantes**: Shadow-lg, rounded-2xl, hover effects
- ✅ **Hover Scale**: Imagem aumenta 110% suavemente
- ✅ **Tipografia**: Hierarquia clara (título, descrição, preço)
- ✅ **Fade-out Lateral**: Gradiente nas laterais (15%) para efeito de
  aparecimento/desaparecimento

### **Funcionalidades**

- ✅ **Integração API**: Busca equipamentos do banco automaticamente
- ✅ **Loading State**: Mensagem enquanto carrega dados
- ✅ **Erro Handling**: Tratamento de erros de fetch
- ✅ **SSR Safe**: Funciona com Next.js App Router
- ✅ **Pausa inteligente**: Pausa quando fora da viewport ou com aba oculta
- ✅ **Prefers reduced motion**: Mantem auto-scroll em zero quando o usuario
  reduz movimento

## 🔧 Instalação e Uso

### **Import**

```tsx
import { EquipmentInfiniteScroll } from "@/components/equipment-infinite-scroll"
```

### **Uso Básico**

```tsx
<EquipmentInfiniteScroll />
```

### **Uso com Classe Customizada**

```tsx
<EquipmentInfiniteScroll className="my-custom-wrapper" />
```

## 📦 Props API

### **EquipmentInfiniteScrollProps**

| Prop        | Tipo     | Obrigatório | Default | Descrição              |
| ----------- | -------- | ----------- | ------- | ---------------------- |
| `className` | `string` | ❌ Não      | `''`    | Classes CSS adicionais |

## 🎨 Estrutura do Card

### **Layout**

```
┌─────────────────────────┐
│  Imagem (200px height)  │
├─────────────────────────┤
│  Título (bold, slate)   │
│  Descrição (2 linhas)   │
│  R$ XX.XX /dia (laranja)│
└─────────────────────────┘
```

### **Dimensões**

- **Width**: 320px (fixo)
- **Height**: Automático (baseado em conteúdo)
- **Image Height**: 200px
- **Padding**: 6 (24px)
- **Gap entre cards**: 6 (24px)

### **Cores**

- **Background Cards**: `bg-white`
- **Background Seção**: `bg-gradient-to-br from-slate-50 to-blue-50`
- **Título**: `text-slate-900`
- **Descrição**: `text-slate-600`
- **Preço**: `text-orange-600` (destaque)
- **Shadow**: `shadow-lg` → `hover:shadow-2xl`

## ⚡ Sistema de Animação

### **Linha 1 (Direita → Esquerda)**

```tsx
gsap.to(row1Ref.current, {
  x: "-50%", // Move metade do conteúdo
  duration: 40, // 40 segundos por ciclo
  ease: "none", // Velocidade constante
  repeat: -1 // Loop infinito
})
```

### **Linha 2 (Esquerda → Direita)**

```tsx
gsap.to(row2Ref.current, {
  x: "0%", // Retorna à posição inicial
  duration: 40, // 40 segundos por ciclo
  ease: "none", // Velocidade constante
  repeat: -1, // Loop infinito
  startAt: { x: "-50%" } // Começa pela metade
})
```

### **Por Que Funciona o Loop Infinito?**

1. **Duplicação de Dados**: `[...equipments, ...equipments, ...equipments]`
2. **Movimento de 50%**: Quando chega ao fim do primeiro array, já está
   mostrando o segundo
3. **Transição Imperceptível**: Volta ao início sem quebra visual

## 🎨 Efeito Fade-out Lateral

### **Implementação**

```tsx
{/* Overlays absolutas nas laterais */}
<div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[15%]
     bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent" />
<div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[15%]
     bg-gradient-to-l from-blue-50 via-blue-50/80 to-transparent" />
```

### **Características**

- **Largura**: 15% de cada lado (total 30% coberto)
- **Altura**: 100% (`inset-y-0`)
- **Posicionamento**: `absolute` sobre o conteúdo
- **Z-index**: 10 (acima dos cards)
- **Pointer Events**: `none` (não interfere em cliques)
- **Gradiente**: 3 stops (sólido → 80% → transparente)

### **Propósito**

Criar a ilusão de que os cards "aparecem" de um lado e "desaparecem" do outro,
sugerindo continuidade infinita sem bordas abruptas.

## 🔄 Fluxo de Dados

```
1. Componente monta
   ↓
2. useEffect dispara fetch de `/api/equipments`
   ↓
3. Dados retornam e são salvos em state
   ↓
4. Array é limitado a 18 equipamentos (performance)
   ↓
5. Array é triplicado [...limitedEquipments, ...limitedEquipments, ...limitedEquipments]
   ↓
6. GSAP inicia animações em ambas as linhas
   ↓
7. Overlays de fade-out renderizadas acima
   ↓
8. Loop infinito roda continuamente
```

## 🎯 Casos de Uso

### **1. Homepage Showcase**

```tsx
// Seção de destaque na homepage
<section className="py-20">
  <EquipmentInfiniteScroll />
</section>
```

### **2. Página de Categoria**

```tsx
// Exibir equipamentos de uma categoria específica
// (modificar componente para aceitar filtro)
<EquipmentInfiniteScroll categoryId="123" />
```

### **3. Landing Page**

```tsx
// Seção visual impactante
<div className="bg-slate-900">
  <EquipmentInfiniteScroll className="py-16" />
</div>
```

## 🎨 Customização

### **Ajustar Velocidade**

Edite a prop `duration` nas animações GSAP:

```tsx
// Mais rápido (20s)
duration: 20

// Mais lento (60s)
duration: 60
```

### **Ajustar Largura dos Cards**

Edite a classe `w-[320px]` no componente:

```tsx
// Cards maiores
className = "w-[400px]"

// Cards menores
className = "w-[280px]"
```

### **Ajustar Gap Entre Cards**

Edite a classe `gap-6` no container:

```tsx
// Gap maior
className = "flex gap-8"

// Gap menor
className = "flex gap-4"
```

## 🐛 Troubleshooting

### **Problema: Cards não aparecem**

**Causa**: API não retornando dados ou erro de fetch **Solução**: Verifique
console, confirme que `/api/equipments` está respondendo

### **Problema: Animação não inicia**

**Causa**: GSAP não está instalado ou refs não estão setados **Solução**:
Confirme `pnpm list gsap`, verifique refs no useEffect

### **Problema: Loop quebra visualmente**

**Causa**: Array não duplicado ou duration muito curta **Solução**:
Certifique-se que `[...equipments, ...equipments]` está correto

### **Problema: Performance ruim**

**Causa**: Muitos cards ou imagens pesadas **Solução**: Limite quantidade de
equipamentos, otimize imagens com Next/Image

## 📊 Performance

### **Otimizações Aplicadas**

- ✅ **willChange: 'transform'**: Hints para GPU acceleration
- ✅ **GSAP**: Engine de animação otimizado
- ✅ **Next/Image**: Otimização automática de imagens
- ✅ **Pausa automática**: Pausa quando fora da viewport ou com aba oculta
- ✅ **Triplicacao controlada**: 3x para loop seamless
- ✅ **ScrollWidth cacheado**: Mede o ciclo uma vez e atualiza no resize para
  evitar reflow por frame
- ✅ **Listas memoizadas**: Duplica arrays e cards com memo para reduzir renders

### **Métricas Esperadas (metas, não medições desta revisão)**

- **FPS**: 60fps constante
- **CPU**: < 5% em desktop moderno
- **Memory**: ~50MB adicional (imagens)
- **Smooth**: Sem jank ou stuttering

## 🔗 Arquivos Relacionados

- **Componente**:
  `packages/frontend/src/widgets/home-cliente/ui/ScrollInfinito.web.tsx`
- **Página Demo**:
  `apps/clients/web/src/app/(labs)/equipamentos-scroll/page.tsx`, consumindo
  `packages/frontend/src/pages/equipamentos-scroll/ui/EquipamentosScrollPage.web.tsx`.
- **API Endpoint**: `apps/services/api/src/app/api/equipments/route.ts`,
  composto pelo catálogo público em `host/runtime.ts`.
- **Limite atual da demo**: `ScrollInfinito.web.tsx` faz
  `fetch("/api/equipments")` sem enviar `tenantSlug`. A API exige contexto de
  locadora e responde 409 quando ele está ausente; a existência da rota de
  laboratório não garante cards carregados. Não inserir locadora padrão nem
  tomar dados mock como prova desse fluxo.
- **Types**: Definidos inline no componente

## 📝 Melhorias Futuras

- [ ] Adicionar filtro por categoria
- [ ] Pausar animação no hover do card
- [ ] Adicionar indicadores de navegação
- [ ] Modo carousel com controles
- [ ] Lazy loading de imagens
- [ ] Suporte a mais de 2 linhas

---

**Última atualização**: 2026-01-04 **Versão**: 1.1.0 **Autor**: GB-Locações Team
