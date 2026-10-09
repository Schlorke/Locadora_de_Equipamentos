# 278-toast

Wrappers Sonner de `hooks/use-toast.ts` e `hooks/use-toast-sonner.ts` foram para
`packages/frontend/src/shared/lib`. API `toast` / `useSonner` inalterada; lib
continua Sonner. Legados apagados (zero imports de código). Estado intermediate.

```yaml
fatia:
  id: 278-toast
  estado: intermediate
  conceito: reexport Sonner de hooks/ para shared/lib
  origem:
    - hooks/use-toast.ts
    - hooks/use-toast-sonner.ts
  destino:
    - packages/frontend/src/shared/lib/toast.ts
    - packages/frontend/src/shared/lib/toast.test.ts
    - packages/frontend/src/shared/lib/index.ts
    - packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx
    - packages/frontend/src/widgets/contato-home/ui/ContatoHome.web.tsx
    - packages/frontend/src/widgets/personalizar-icone/ui/Bloco.tsx
    - packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.tsx
    - packages/frontend/src/features/notificacoes/ui/Dropdown.web.tsx
    - packages/frontend/src/pages/notificacoes/ui/NotificacoesPage.web.tsx
    - components/admin/admin-header-actions.tsx
    - components/quote-form.tsx
    - app/playground/icon-customization/page.tsx
  invariantes:
    - id: api-toast-sonner
      prova: 'toast.test.ts: export { toast, useSonner } from "sonner"'
    - id: sem-plataforma
      prova: "toast.test.ts: fonte sem next/, react-dom e react-native"
    - id: sem-hooks-legado
      prova:
        "rg hooks/use-toast em *.ts/*.tsx de produto = 0; arquivos
        hooks/use-toast*.ts ausentes"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/shared/lib/toast.test.ts"
      exit: 0
      verificado_em: "2026-09-25 16:04"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:04"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:04"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "docs/features e docs/guides ainda citam @/hooks/use-toast (fora do
        escopo 278)"
      - "hooks/use-icon-recents.ts e use-settings.tsx permanecem legados (outras
        fatias)"
  aposentado:
    - hooks/use-toast.ts
    - hooks/use-toast-sonner.ts
  nao_verificado:
    - "[NOT_VERIFIED: toast no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
