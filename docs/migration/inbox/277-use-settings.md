# 277-use-settings

Contexto React de settings (`SettingsProvider` / `useSettings` e helpers) saiu
de `hooks/use-settings.tsx` para o slice `pages/configuracoes`, dono da UI de
configurações admin. Sem `next/*` → arquivo `.tsx` universal (não `.web`).
Telefones, e-mails, `America/Sao_Paulo` e `maxQuoteItems` não foram
reintroduzidos (ficam em `use-settings-data` / página). Sem Prisma. Legado
apagado; nenhum consumer legado. `entities/configuracao` intacto. Estado
intermediate.

```yaml
fatia:
  id: 277-use-settings
  estado: intermediate
  conceito: mover hooks/use-settings.tsx para pages/configuracoes
  origem:
    - hooks/use-settings.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/model/use-settings.tsx
    - packages/frontend/src/pages/configuracoes/model/use-settings.test.ts
    - packages/frontend/src/pages/configuracoes/index.ts
  invariantes:
    - id: sem-duplicar-contatos-sistema
      prova:
        "use-settings.test.ts: ausentes (51) 2313-6262, (51) 99820-5163,
        contato@, comercial@, America/Sao_Paulo, maxQuoteItems"
    - id: sem-prisma
      prova:
        "use-settings.tsx importa só getSettings de actions; teste bloqueia
        @prisma/prisma"
    - id: index-publico
      prova:
        "pages/configuracoes/index.ts reexporta SettingsProvider, useSettings e
        helpers"
    - id: sem-next-star
      prova: "use-settings.tsx sem import next/* (não precisa .web)"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
      verificado_em: "2026-09-25 16:03"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:03"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 16:03"
  gate:
    arch: pass
    tokens: fail_externo
    violacoes_conhecidas:
      - "token-check: HeroCarouselPreview.web.tsx literais de cor/borda (fora da
        fatia 277; hero-carousel-preview proibido)"
      - "#ea580c em use-settings.tsx permitido via token-check-allow"
      - "entities/configuracao não foi alterado"
      - "use-settings-data fora do escopo desta fatia"
  aposentado:
    - hooks/use-settings.tsx
  nao_verificado:
    - "[NOT_VERIFIED: SettingsProvider montado em layout/browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: refresh de settings via getSettings em runtime]"
```
