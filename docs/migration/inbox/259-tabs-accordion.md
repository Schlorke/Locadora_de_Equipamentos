# 259-tabs-accordion

As abas e o acordeão saíram de `components/ui/tabs.tsx` e
`components/ui/accordion.tsx`. As classes web (lista cinza, gatilho ativo
`text-orange-600`, foco `ring-orange-500`, borda do item, chevron e animações
accordion) permanecem. O nativo usa Pressable/View sem repetir Tailwind. Nenhum
`.ts`/`.tsx` de produto importava os legados; os arquivos foram aposentados.
Esta fatia está em estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 259-tabs-accordion
  estado: intermediate
  conceito: abas e acordeão
  origem:
    - components/ui/tabs.tsx
    - components/ui/accordion.tsx
  destino:
    - packages/ui/src/contract/tabs.ts
    - packages/ui/src/contract/accordion.ts
    - packages/ui/src/web/Tabs.web.tsx
    - packages/ui/src/native/Tabs.native.tsx
    - packages/ui/src/web/Accordion.web.tsx
    - packages/ui/src/native/Accordion.native.tsx
  invariantes:
    - id: abas
      prova:
        "Tabs.web.test.tsx: h-10 bg-gray-100, ativo text-orange-600, focus
        ring-orange-500; nativo sem text-orange-600 nem bg-gray-100"
    - id: acordeao
      prova:
        "Accordion.web.test.tsx: border-b, hover:underline, chevron h-4 w-4,
        animate-accordion-up/down, pb-4 pt-0; nativo sem border-b nem
        animate-accordion"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/ui/src/web/Tabs.web.test.tsx
        packages/ui/src/web/Accordion.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:53"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:53"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:53"
      nota:
        "falhas pré-existentes fora desta fatia (cta-button, CategoriasPage);
        zero TOKEN em Tabs/Accordion"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "token-check exit 1 por literais em
        packages/ui/src/contract/cta-button.ts e CategoriasPage.web.tsx (fora do
        escopo 259)"
      - "form.tsx e outros primitivos ainda misturados em components/ui"
      - "app/, components/ e hooks/ continuam donos do restante da UI"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado:
    - components/ui/tabs.tsx
    - components/ui/accordion.tsx
  nao_verificado:
    - "[NOT_VERIFIED: abas e acordeão no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
