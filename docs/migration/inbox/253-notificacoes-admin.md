# 253-notificacoes-admin

Fatia **bloqueada**. Não existe tela de produto em `app/admin/notificacoes/**`
(caminho ausente no disco; também ausente da lista de URLs em
`docs/migration/00-plano.md`). A rota cliente
`app/area-cliente/notificacoes/page.tsx` já é shell fino para
`@gb-locacoes/frontend/pages/notificacoes` e **não** foi tocada, conforme
contrato da fatia. Nenhum movimento para `packages/frontend`, rota shell admin,
Vitest, arch-check ou token-check foi executado. PARE.

```yaml
fatia:
  id: 253-notificacoes-admin
  estado: bloqueado
  conceito: notificações admin
  origem:
    - app/admin/notificacoes/**
  destino: []
  motivo_bloqueio: >-
    Caminho app/admin/notificacoes/** inexistente no repositório; fatia
    exclusiva sem fonte para migrar. A página pública/cliente em
    app/area-cliente/notificacoes e o slice pages/notificacoes permanecem
    intactos (já shell; fora do escopo desta fatia).
  invariantes: []
  comandos: []
  gate:
    arch: nao_aplicavel
    tokens: nao_aplicavel
    vitest_platform: nao_aplicavel
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: tela /admin/notificacoes]"
    - "[NOT_VERIFIED: pnpm exec vitest run --config vitest.platform.config.ts]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
