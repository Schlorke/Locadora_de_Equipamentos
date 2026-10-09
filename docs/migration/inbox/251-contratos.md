# 251-contratos

Fatia **bloqueada**. Não existe tela admin em `app/admin/contratos/**` nem em
`app/admin/zapsign/**`. Em `app/admin/` há apenas: categorias, dashboard, email,
equipamentos, financeiro, login, logistics, maintenance, orcamentos,
permissions, rentals, settings, teste-toast, whatsapp. O plano de URLs
(`docs/migration/00-plano.md`) também não lista `/admin/contratos` nem
`/admin/zapsign`.

Há rotas de API (`app/api/contracts/**`, inclusive `zapsign-webhook`), fora do
escopo desta fatia de página. Sem origem de UI, não há slice em
`packages/frontend/src/pages`, nem shell de rota, nem gates.

```yaml
fatia:
  id: 251-contratos
  estado: blocked
  conceito: tela admin de contratos / ZapSign
  origem:
    - app/admin/contratos/** (ausente)
    - app/admin/zapsign/** (ausente)
  destino: []
  motivo_bloqueio: >-
    Nenhuma pasta app/admin/contratos/** ou app/admin/zapsign/** existe no
    repositório; não há page.tsx admin para migrar. APIs de contrato/ZapSign não
    entram nesta fatia.
  invariantes: []
  comandos: []
  gate:
    arch: skipped
    tokens: skipped
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: tela admin contratos no browser]"
    - "[NOT_VERIFIED: pnpm exec vitest platform]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
