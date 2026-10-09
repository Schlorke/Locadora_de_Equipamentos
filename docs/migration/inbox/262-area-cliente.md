# 262-area-cliente

Fatia **bloqueada**. Todas as `page.tsx` em `app/area-cliente` (exceto o escopo
`[id]` já tratado como shell) já são shells finos que reexportam o slice em
`packages/frontend/src/pages/*`. Nenhuma tela com UI própria restante. Nenhum
movimento, Vitest, arch-check ou token-check foi executado. PARE conforme
contrato da fatia.

Rotas verificadas (todas shell):

| Rota                           | Shell importa                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `/area-cliente`                | `@gb-locacoes/frontend/pages/area-cliente` → `AreaClientePage`                                                               |
| `/area-cliente/historico`      | `@gb-locacoes/frontend/pages/historico` → `HistoricoPage`                                                                    |
| `/area-cliente/enderecos`      | `@gb-locacoes/frontend/pages/enderecos` → `EnderecosPage`                                                                    |
| `/area-cliente/perfil`         | `@gb-locacoes/frontend/pages/perfil` → `PerfilPage`                                                                          |
| `/area-cliente/notificacoes`   | `@gb-locacoes/frontend/pages/notificacoes` → `NotificacoesPage`                                                              |
| `/area-cliente/historico/[id]` | `@gb-locacoes/frontend/pages/historico-detalhe` → `RentalDetailsPage` (já shell; fora do critério “primeira com UI própria”) |

```yaml
fatia:
  id: 262-area-cliente
  estado: bloqueado
  conceito: área do cliente (pages)
  origem:
    - app/area-cliente/page.tsx
    - app/area-cliente/historico/page.tsx
    - app/area-cliente/enderecos/page.tsx
    - app/area-cliente/perfil/page.tsx
    - app/area-cliente/notificacoes/page.tsx
  destino:
    - packages/frontend/src/pages/area-cliente
    - packages/frontend/src/pages/historico
    - packages/frontend/src/pages/enderecos
    - packages/frontend/src/pages/perfil
    - packages/frontend/src/pages/notificacoes
  motivo_bloqueio: >-
    Todas as page.tsx em app/area-cliente já são shells sem UI própria; slices
    pages correspondentes já existem. Sem página gorda para mover.
  invariantes: []
  comandos: []
  gate:
    arch: skipped
    tokens: skipped
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm exec vitest platform]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
