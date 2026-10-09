# 256-locacoes-rota

Fatia **bloqueada**. `app/admin/locacoes/**` não existe no repositório. A rota
de produto equivalente é `/admin/rentals` em `app/admin/rentals/page.tsx`, que
**já é shell**: só importa e renderiza `AdminRentalsPage` de
`@gb-locacoes/frontend/pages/locacoes`. O corpo já está em
`packages/frontend/src/pages/locacoes` (formatador próprio em `ui/formatar.tsx`,
distinto de manutenção). Multa de locação (5% da diária na API de rentals)
permanece separada da multa de orçamento (2% ao dia).

Nenhum código de produto foi alterado. Gates (Vitest platform, arch-check,
token-check) não foram executados: não há movimento a validar. PARE conforme
contrato da fatia.

```yaml
fatia:
  id: 256-locacoes-rota
  estado: bloqueado
  conceito: rota shell admin de locações
  origem:
    - app/admin/locacoes/**
    - app/admin/rentals/page.tsx
  destino:
    - packages/frontend/src/pages/locacoes
  motivo_bloqueio: >-
    app/admin/locacoes/** ausente; app/admin/rentals/page.tsx já é shell
    (AdminRentalsPage de @gb-locacoes/frontend/pages/locacoes). Corpo já
    migrado. Sem trabalho nesta fatia.
  invariantes:
    - multa locação 5% diária ≠ multa orçamento 2% ao dia
    - formatador locações ≠ formatador manutenção
    - URL /admin/rentals inalterada
  comandos: []
  gate:
    arch: nao_aplicavel
    tokens: nao_aplicavel
    vitest_platform: nao_aplicavel
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm exec vitest run --config vitest.platform.config.ts]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
