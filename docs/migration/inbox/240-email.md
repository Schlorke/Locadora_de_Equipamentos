# 240-email

A tela saiu de `app/admin/email/page.tsx` e o hook exclusivo
`hooks/use-email-page.ts`. A URL `/admin/email` continua no shell fino, que só
renderiza `AdminEmailPage`. Título, subtítulo Zoho, diálogos de lixeira/spam e
payloads `/api/admin/zoho-mail/*` permanecem. Componentes em
`components/admin/email/**` ficam legados (uso exclusivo desta área, fora do
movimento da fatia de page). `loading.tsx` da rota Next permanece. Esta fatia
está em estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 240-email
  estado: intermediate
  conceito: página admin E-mail (Zoho Mail)
  origem:
    - app/admin/email/page.tsx
    - hooks/use-email-page.ts
  destino:
    - packages/frontend/src/pages/email-admin/ui/EmailAdminPage.web.tsx
    - packages/frontend/src/pages/email-admin/model/carga.web.ts
    - packages/frontend/src/pages/email-admin/index.ts
  invariantes:
    - id: titulo-zoho-dialogs
      prova:
        "EmailAdminPage.web.test.tsx: E-mail, subtítulo Zoho, Conectar Zoho
        Mail, diálogos lixeira/spam, Suspense"
    - id: hook-apis
      prova:
        "EmailAdminPage.web.test.tsx: useEmailPage, next/navigation,
        admin-email-search, /api/admin/zoho-mail"
    - id: shell
      prova:
        "EmailAdminPage.web.test.tsx: rota importa
        @gb-locacoes/frontend/pages/email-admin e retorna AdminEmailPage"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/email-admin/ui/EmailAdminPage.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:52"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:52"
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:52"
      nota: >-
        8 violações pré-existentes em
        packages/frontend/src/pages/equipamentos-admin (Editar.web.tsx /
        Novo.web.tsx). Nenhuma violação em email-admin. Fora do escopo exclusivo
        desta fatia.
  gate:
    arch: pass
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "token-check falha em equipamentos-admin Editar/Novo (fora da fatia 240)"
      - "components/admin/email/* continua legado"
      - "app/admin/email/loading.tsx permanece na rota Next"
  aposentado:
    - hooks/use-email-page.ts
  nao_verificado:
    - "[NOT_VERIFIED: página /admin/email no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
