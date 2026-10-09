# 252-pagamentos

Fatia **bloqueada**. Não há tela de produto em `app/admin/pagamentos/**` nem em
`app/admin/payments/**` para mover. A listagem de `app/admin/**/page.tsx` não
inclui essas rotas; o plano em `docs/migration/00-plano.md` também não as lista
entre as URLs de página. Docs legadas citam `/admin/payments` (ex.: guia Asaas),
mas o diretório de página não existe no repositório. `app/admin/financeiro` está
fora do escopo desta fatia e não foi tocado.

Nenhum código de produto foi alterado. Gates (Vitest platform, arch-check,
token-check) não foram executados: não há movimento a validar.

```yaml
fatia:
  id: 252-pagamentos
  estado: bloqueado
  conceito: tela admin de pagamentos
  origem: []
  destino: []
  motivo_bloqueio: >-
    Ausência de app/admin/pagamentos/** e app/admin/payments/** (não-shell). Sem
    origem, não há slice em packages/frontend/src/pages nem rota shell.
  invariantes: []
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
    - "[NOT_VERIFIED: existência futura de /admin/pagamentos ou /admin/payments]"
```
