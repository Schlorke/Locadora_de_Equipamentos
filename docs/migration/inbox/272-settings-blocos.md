# 272-settings-blocos

Hook e blocos de settings saíram do legado para o slice `pages/configuracoes`. A
página e a rota `/admin/settings` já existiam (fatia 246). Telefones
`(51) 2313-6262` e `(51) 99820-5163`, e-mails `contato@` /
`comercial@locacoesgb.com.br`, fuso `America/Sao_Paulo` e `maxQuoteItems: 50`
permanecem. `entities/configuracao` não foi alterado.

`hero-carousel-preview.tsx` **não** importa `model-viewer`,
`equipment-3d-carousel` nem `scroll-reveal`; ficou no legado por estar fora da
fatia exclusiva (continua importado pela page). `header-footer-preview.tsx`
também permanece legado (dependência de `SettingsPreviews`).

```yaml
fatia:
  id: 272-settings-blocos
  estado: intermediate
  conceito: hook e blocos UI de configurações admin
  origem:
    - hooks/use-settings-data.tsx
    - components/admin/settings-block.tsx
    - components/admin/settings-navigation-bar.tsx
    - components/admin/settings-previews.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/model/use-settings-data.tsx
    - packages/frontend/src/pages/configuracoes/ui/SettingsBlock.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/SettingsNavigationBar.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/SettingsPreviews.web.tsx
  invariantes:
    - id: contatos
      prova:
        "use-settings-data.tsx + ConfiguracoesPage.web.test.tsx: (51) 2313-6262,
        (51) 99820-5163, contato@ e comercial@locacoesgb.com.br"
    - id: sistema-preview
      prova: "ConfiguracoesPage.web.tsx: America/Sao_Paulo e maxQuoteItems: 50"
    - id: hero-preview-legado
      prova:
        "ConfiguracoesPage.web.tsx continua importando
        components/admin/hero-carousel-preview"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
  gate:
    arch: fail-preexistente
    tokens: fail-preexistente
    violacoes_conhecidas:
      - "RUNTIME-WEB-ONLY em pages/email-admin/ui/email-folder-list.tsx (outra
        fatia)"
      - "TOKEN number-literal em packages/ui/src/native/Progress.native.tsx
        (outra fatia)"
      - "literais de preview/settings em configuracoes cobertos com
        token-check-allow"
      - "hero-carousel-preview.tsx permanece legado (fora da fatia exclusiva;
        sem imports 3D/scroll-reveal)"
      - "header-footer-preview.tsx permanece legado (só usado por
        SettingsPreviews)"
      - "entities/configuracao não foi alterado"
  aposentado:
    - hooks/use-settings-data.tsx
    - components/admin/settings-block.tsx
    - components/admin/settings-navigation-bar.tsx
    - components/admin/settings-previews.tsx
  nao_verificado:
    - "[NOT_VERIFIED: /admin/settings no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: salvar/resetar seções]"
    - "[NOT_VERIFIED: upload de logo]"
```
