# 245-analytics

Fatia **bloqueada**. A pasta de página `app/admin/analytics/**` **não existe**
no repositório (verificado em 2026-09-25). Em `app/admin/` há: categorias,
dashboard, email, equipamentos, financeiro, login, logistics, maintenance,
orcamentos, permissions, rentals, settings, teste-toast, whatsapp — sem
`analytics`.

Existe apenas a API `app/api/admin/analytics/route.ts`, fora do escopo exclusivo
desta fatia (`app/admin/analytics/**`). Nenhum movimento para
`packages/frontend`, rota shell, Vitest, arch-check ou token-check foi
executado. Nenhum outro arquivo foi alterado.

```yaml
fatia:
  id: 245-analytics
  estado: bloqueado
  conceito: tela admin analytics
  motivo:
    "pasta app/admin/analytics/** ausente; page não encontrada para migrar"
  origem:
    - app/admin/analytics/** (inexistente)
  destino: []
  invariantes: []
  comandos: []
  gate:
    arch: skipped
    tokens: skipped
    vitest: skipped
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm exec vitest run --config vitest.platform.config.ts]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
  observacao:
    "API app/api/admin/analytics/route.ts permanece intacta e fora desta fatia"
```
