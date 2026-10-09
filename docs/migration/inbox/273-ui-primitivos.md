# 273-ui-primitivos

Três primitivos sem regra de negócio saíram de `components/ui/`: `aspect-ratio`,
`collapsible` e `progress`. Cada um ganhou contrato + web + native em
`packages/ui`. Web preserva o Radix (e as classes `bg-secondary`/`bg-primary` do
Progress). Native não repete Tailwind. Nenhum `.ts`/`.tsx` de produto importava
os legados; os arquivos foram aposentados. Esta fatia está em estado
intermediate; a migração não está concluída.

```yaml
fatia:
  id: 273-ui-primitivos
  estado: intermediate
  conceito: aspect-ratio, collapsible e progress
  origem:
    - components/ui/aspect-ratio.tsx
    - components/ui/collapsible.tsx
    - components/ui/progress.tsx
  destino:
    - packages/ui/src/contract/aspect-ratio.ts
    - packages/ui/src/contract/collapsible.ts
    - packages/ui/src/contract/progress.ts
    - packages/ui/src/web/AspectRatio.web.tsx
    - packages/ui/src/native/AspectRatio.native.tsx
    - packages/ui/src/web/Collapsible.web.tsx
    - packages/ui/src/native/Collapsible.native.tsx
    - packages/ui/src/web/Progress.web.tsx
    - packages/ui/src/native/Progress.native.tsx
  invariantes:
    - id: aspect-ratio
      prova:
        "AspectRatio.web.test.tsx: Root do Radix; native com aspectRatio e sem
        className/bg-"
    - id: collapsible
      prova:
        "Collapsible.web.test.tsx: Root/Trigger/Content Radix; native Pressable
        sem data-[state="
    - id: progress
      prova:
        "Progress.web.test.tsx: bg-secondary, bg-primary, translateX; native sem
        essas classes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/AspectRatio.web.test.tsx
        packages/ui/src/web/Collapsible.web.test.tsx
        packages/ui/src/web/Progress.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:59"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:59"
      nota:
        "FSD-PUBLIC-API widgets/cartao-equipamento sem index — fora desta fatia;
        zero violação em AspectRatio/Collapsible/Progress"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:59"
      nota:
        "2 TOKEN em Cartao.native.tsx (fora do escopo); zero TOKEN em
        AspectRatio/Collapsible/Progress"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "arch-check exit 1 por widgets/cartao-equipamento sem index público
        (fora do escopo 273)"
      - "token-check exit 1 por literais em Cartao.native.tsx (fora do escopo
        273)"
      - "hover-card, radio-group, slider, toggle, drawer e outros ainda
        misturados em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/aspect-ratio.tsx
    - components/ui/collapsible.tsx
    - components/ui/progress.tsx
  nao_verificado:
    - "[NOT_VERIFIED: AspectRatio/Collapsible/Progress no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
