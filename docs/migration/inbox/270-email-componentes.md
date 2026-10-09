# 270-email-componentes

Os componentes exclusivos da caixa Zoho saíram de `components/admin/email/**`
para o slice `email-admin` em `ui/`. A página importa layout, full-view e
composer por caminho relativo same-slice. Tipos (`Account`, pastas, mensagens,
`ComposerMode`) ficam em `ui/types.ts`, consumidos pelo model `carga.web`.
`email-folder-list` virou `.web.tsx` por causa de `react-dom` (createPortal).
Payloads `/api/admin/zoho-mail/*`, textos Zoho e `loading.tsx` da rota Next
permanecem. Pasta legada `components/admin/email` removida. Esta fatia está em
estado intermediate; a migração não está concluída.

```yaml
fatia:
  id: 270-email-componentes
  estado: intermediate
  conceito: componentes UI exclusivos da página admin E-mail (Zoho)
  origem:
    - components/admin/email/email-layout-container.tsx
    - components/admin/email/email-full-view-dialog.tsx
    - components/admin/email/email-composer-dialog.tsx
    - components/admin/email/email-folder-list.tsx
    - components/admin/email/email-message-list.tsx
    - components/admin/email/email-viewer.tsx
    - components/admin/email/types.ts
  destino:
    - packages/frontend/src/pages/email-admin/ui/email-layout-container.tsx
    - packages/frontend/src/pages/email-admin/ui/email-full-view-dialog.tsx
    - packages/frontend/src/pages/email-admin/ui/email-composer-dialog.tsx
    - packages/frontend/src/pages/email-admin/ui/email-folder-list.web.tsx
    - packages/frontend/src/pages/email-admin/ui/email-message-list.tsx
    - packages/frontend/src/pages/email-admin/ui/email-viewer.tsx
    - packages/frontend/src/pages/email-admin/ui/types.ts
  loading_rota:
    - app/admin/email/loading.tsx
  invariantes:
    - id: zoho-textos
      prova:
        "EmailAdminPage.web.test.tsx: E-mail, subtítulo Zoho, Conectar Zoho
        Mail, contato@locacoesgb.com.br"
    - id: payloads-composer
      prova:
        "EmailAdminPage.web.test.tsx: upload, drafts, send, reply em
        email-composer-dialog"
    - id: imports-same-slice
      prova:
        "EmailAdminPage.web.test.tsx: ./email-layout-container,
        ./email-full-view-dialog, ./email-composer-dialog; carga ../ui/types"
    - id: loading-next
      prova:
        "EmailAdminPage.web.test.tsx: app/admin/email/loading.tsx
        AdminEmailLoading"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/email-admin/ui/EmailAdminPage.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:58"
    - cmd: "node tools/arch-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        FSD-PUBLIC-API widgets/cartao-equipamento sem index (fora desta fatia).
        RUNTIME-WEB-ONLY de email-folder-list corrigido com sufixo .web.tsx.
        Nenhuma violação em email-admin.
    - cmd: "node tools/token-check.mjs"
      exit: 1
      verificado_em: "2026-09-25 15:58"
      nota: >-
        2 violações em widgets/cartao-equipamento/ui/Cartao.native.tsx
        (borderWidth/borderTopWidth). Nenhuma violação em email-admin. Fora do
        escopo exclusivo desta fatia.
  gate:
    arch: fail_externo
    tokens: fail_externo
    vitest_platform: pass
    violacoes_conhecidas:
      - "arch: FSD-PUBLIC-API widgets/cartao-equipamento (fora da fatia 270)"
      - "token: Cartao.native.tsx borderWidth literais (fora da fatia 270)"
      - "legado @/lib/utils, @/lib/sanitize, @/components/ui/resizable ainda
        usados pelos componentes movidos"
      - "app/admin/email/loading.tsx permanece na rota Next (arquivo especial do
        App Router)"
  aposentado:
    - components/admin/email/email-layout-container.tsx
    - components/admin/email/email-full-view-dialog.tsx
    - components/admin/email/email-composer-dialog.tsx
    - components/admin/email/email-folder-list.tsx
    - components/admin/email/email-message-list.tsx
    - components/admin/email/email-viewer.tsx
    - components/admin/email/types.ts
    - components/admin/email/ (pasta)
  nao_verificado:
    - "[NOT_VERIFIED: página /admin/email no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
