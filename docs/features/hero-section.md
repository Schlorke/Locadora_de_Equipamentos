# 🌅 Hero Section Layout

## 📋 Visão Geral

A seção Hero da homepage utiliza um layout em camadas com carrossel de fundo,
gradiente, indicadores e onda decorativa. Após o ajuste de novembro de 2025,
todos esses elementos passaram a respeitar o mesmo container responsivo
`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`, garantindo alinhamento e
espaçamento idênticos às demais seções da página.

## 🧱 Estrutura Principal

| Camada                    | Descrição                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `<section>`               | Wrapper externo que define o fundo principal e o padding vertical (`pb-12 md:pb-16 lg:pb-20`)                                 |
| `containerClasses`        | Constante reutilizada em `packages/frontend/src/widgets/hero/ui/Hero.web.tsx` com o padrão `max-w-7xl` + paddings responsivos |
| Carousel + Gradient       | Preenchem 100% da largura da seção com wrapper `overflow-hidden` para evitar bleed nas laterais                               |
| Indicadores do carrossel  | 100% width (`left-0 right-0`) com alinhamento central via `flex`                                                              |
| Onda (`.hero-wave`)       | SVG fixado no rodapé da seção ocupando 100% da largura disponível                                                             |
| Conteúdo textual e imagem | Mantém grid de duas colunas com `gap-12 lg:gap-16` seguindo o design system                                                   |

```tsx
const containerClasses = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
```

## 🎯 Objetivos do Ajuste

- Eliminar a sensação de “padding extra” que o carrossel e a onda provocavam ao
  ultrapassar o container principal.
- Garantir alinhamento perfeito entre Hero, seções de destaque e grids de
  conteúdo (todas usam o mesmo padrão de container).
- Facilitar manutenção futura: qualquer ajuste de spacing pode ser feito uma
  única vez na constante `containerClasses`.

## 📐 Regras de Espaçamento

- **Padding horizontal**: definido exclusivamente pelo container (mobile `px-4`,
  tablet `sm:px-6`, desktop `lg:px-8`).
- **Padding vertical**: controlado na `<section>` para contemplar a altura da
  onda (`pb-12 md:pb-16 lg:pb-20`).
- **Overlap controlado**: o wrapper do carrossel usa `pointer-events-none` para
  não interferir em interações do conteúdo.
- **Rodapé uniforme**: indicadores e onda usam `absolute bottom-*` cobrindo toda
  a largura da seção, sem alterar o padding global.
- **Bleed prevenido**: wrapper `overflow-hidden` dedicado ao carrossel impede
  extrapolação das imagens quando animadas em tela cheia.

## ♿ Acessibilidade & Animações

- O `aria-roledescription="carousel"` permanece aplicado ao `<section>` apenas
  quando há imagens.
- A classe `.hero-wave` continua integrada ao `scroll-reveal-init`, mantendo a
  animação de entrada.
- Indicadores do carrossel preservam `aria-label` individuais e animações do
  Framer Motion.
- O hover de scale do bloco 3D fica isolado no wrapper `.hero-image-inner` (sem
  `overflow-hidden`), permitindo que o `.hero-image` continue usando o
  `transform` do scroll-reveal sem ser sobrescrito em interações do usuário e
  evitando cortes nos overlays (badges, setas, dots). O `backdrop-filter`
  (blur/saturate) também está aplicado no wrapper interno para acompanhar o
  scale e evitar recortes do noise/blur ao ampliar.

- O background do carrossel espera o evento `scrollRevealReady`, com fallback
  (~600ms) para evitar tela branca em loads lentos.
- Apenas o slide inicial usa `priority`/`fetchPriority="high"` para reduzir
  preload desnecessario.

## 🎬 Sincronização com Carrossel 3D (CRÍTICO)

> **⚠️ ATENÇÃO IA**: Esta lógica DEVE ser preservada em todas as alterações.
> Consulte `docs/features/equipment-3d-carousel.md` para detalhes completos.

O Hero possui uma **sincronização explícita** com o carrossel 3D através do
evento `scrollRevealReady`:

```typescript
// Hero escuta evento do ScrollReveal
const [isScrollRevealReady, setIsScrollRevealReady] = useState(false)

useEffect(() => {
  const handleScrollRevealReady = () => {
    setIsScrollRevealReady(true)
  }
  window.addEventListener('scrollRevealReady', handleScrollRevealReady)
  return () => {
    window.removeEventListener('scrollRevealReady', handleScrollRevealReady)
  }
}, [])

// Passa para o carrossel 3D
<Equipment3DCarousel
  isRevealComplete={isScrollRevealReady} // ✅ Sincronização explícita
/>
```

**Comportamento esperado**:

- Primeiro modelo (compressor): Aparece apenas com fade-in do ScrollReveal, SEM
  animação de zoom
- Modelos seguintes: Exibem animação de zoom normalmente após o ScrollReveal
  terminar

**NUNCA**:

- ❌ Remover o listener do evento `scrollRevealReady`
- ❌ Passar `isRevealComplete` como `true` fixo
- ❌ Alterar esta lógica sem consultar `equipment-3d-carousel.md`

## ✅ Checklist para alterações futuras

- Reutilizar `containerClasses` em qualquer nova camada da Hero.
- Evitar adicionar elementos absolutos fora do container.
- Manter o `overflow-hidden` do wrapper do SVG para impedir sombras fora da área
  útil.
- Testar o alinhamento em 320px, 768px e 1280px antes de finalizar qualquer
  ajuste.

_Atualizado em: 2026-01-04_
