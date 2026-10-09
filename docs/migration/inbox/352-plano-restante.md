# 352-plano-restante

Leitura de `docs/migration/00-plano.md` e do final de
`docs/migration/MIGRATION.md` (até `351-link-web-public`). Varredura no disco
com Node `fs` (`tools/_scan-fat-ui-352.mjs`, sem recurse PowerShell):
`components/` e `hooks/` **ausentes**; `app/api` excluído; `page.tsx` que só
importa `@gb-locacoes/frontend` contados como shell fino.

**Tela gorda de produto fora de `packages/frontend` (não adaptador de host):**
nenhuma. Nada movido. Sem refatoração de API. Sem banco. Sem alteração de
testes. Carrossel 3D não tocado. Sem CHANGELOG (sem código de produto). Sem
commit. Migração **não** concluída.

Arquivos longos restantes em `app/` são adaptadores / host-only já documentados:
`scroll-reveal-init` (sync `scrollRevealReady`, permanece no host), `layout.tsx`
(fonts/metadata/prisma), `equipamentos/[id]/page.tsx` (Prisma + SEO → page do
pacote), `admin-layout-client` (auth + widgets já no FSD),
`login`/`auth/callback`/`page` (injeção next-auth/prisma), loadings e layouts de
rota.

## Prova ainda aberta

Únicos itens de prova ainda abertos:

1. `pnpm test` — bloqueado por ambiente (sem `.env` local; senha do compose
   recusada `28P01`; sem docker/psql).
2. `device_or_emulator` — não verificado.

## Exits já conhecidos (não reexecutados nesta fatia)

| Comando              | Exit (prova anterior) |
| -------------------- | --------------------- |
| `pnpm arch`          | 0                     |
| `pnpm tokens`        | 0                     |
| `pnpm typecheck`     | 0                     |
| `pnpm check:tokens`  | 0                     |
| `pnpm build:web`     | 0                     |
| `pnpm bundle:mobile` | 0                     |
| `pnpm test`          | bloqueado (ambiente)  |

```yaml
fatia:
  id: 352-plano-restante
  estado: intermediate
  conceito: >-
    confirmar se resta tela gorda fora de packages/frontend; se sim mover um
    grupo; senão só inbox + diário com prova aberta = test + device
  movido: []
  tela_gorda_encontrada: false
  leftover_dirs:
    components: false
    hooks: false
  scan:
    tool: tools/_scan-fat-ui-352.mjs
    tsx_fora_packages_apps_exceto_api: 68
    shells_finos: 44
    candidatos_heuristica: 24
    reclassificados_como_host: 24
    telas_produto: 0
  exits_conhecidos_nao_reexecutados:
    pnpm_arch: 0
    pnpm_tokens: 0
    pnpm_typecheck: 0
    pnpm_check_tokens: 0
    pnpm_build_web: 0
    pnpm_bundle_mobile: 0
    pnpm_test: null
  bloqueio_test: >-
    sem .env; senha compose 28P01; sem docker/psql
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test (bloqueado por ambiente)]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  migracao_concluida: false
```
