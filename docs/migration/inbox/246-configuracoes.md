# 246-configuracoes

A tela saiu do corpo de `app/admin/settings/page.tsx` para o slice
`pages/configuracoes`. A URL `/admin/settings` continua no shell fino.
`app/admin/configuracoes` e `app/admin/configuracao` não existem; só `settings`
havia código e ainda não era shell. Telefones `(51) 2313-6262` e
`(51) 99820-5163`, e-mails `contato@locacoesgb.com.br` e
`comercial@locacoesgb.com.br`, nome `GB Locações`, fuso `America/Sao_Paulo` e
`maxQuoteItems: 50` permanecem. O gancho `hooks/use-settings-data` e os blocos
em `components/admin/settings-*` / `hero-carousel-preview` continuam legado.
`entities/configuracao` não foi tocado. `layout.tsx` de auth ADMIN permanece no
host.

```yaml
fatia:
  id: 246-configuracoes
  estado: intermediate
  conceito: configurações do sistema (admin settings)
  origem:
    - app/admin/settings/page.tsx
  destino:
    - packages/frontend/src/pages/configuracoes/index.ts
    - packages/frontend/src/pages/configuracoes/ui/ConfiguracoesPage.web.tsx
    - packages/frontend/src/pages/configuracoes/ui/ConfiguracoesPage.web.test.tsx
  invariantes:
    - id: url-e-shell
      prova:
        "ConfiguracoesPage.web.test.tsx: rota importa
        @gb-locacoes/frontend/pages/configuracoes e renderiza
        AdminConfiguracoesPage"
    - id: contatos-e-marca
      prova:
        "ConfiguracoesPage.web.test.tsx: (51) 2313-6262, (51) 99820-5163,
        contato@ e comercial@locacoesgb.com.br, GB Locações"
    - id: sistema-preview
      prova:
        "ConfiguracoesPage.web.test.tsx: America/Sao_Paulo e maxQuoteItems: 50"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/configuracoes"
      exit: 0
      verificado_em: "2026-09-25 15:51"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:51"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:51"
  gate:
    arch: fail-preexistente
    tokens: fail-preexistente
    violacoes_conhecidas:
      - "FSD-SELF-PACKAGE em
        packages/frontend/src/pages/equipamentos-admin/ui/Lista.web.tsx (outra
        fatia)"
      - "4 TOKEN color/dimension-literal em
        packages/frontend/src/pages/equipamentos-admin/ui/Novo.web.tsx (outra
        fatia)"
      - "hooks/use-settings-data.tsx continua legado"
      - "components/admin/settings-block.tsx, settings-navigation-bar.tsx,
        settings-previews.tsx e hero-carousel-preview.tsx continuam legado"
      - "entities/configuracao não foi alterado nesta fatia"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: /admin/settings no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: salvar/resetar seções company/hero/seo/system/custom]"
    - "[NOT_VERIFIED: upload de logo]"
```
