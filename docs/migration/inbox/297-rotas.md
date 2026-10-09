# 297-rotas

Fatia **bloqueada**. Nenhuma `app/**/page.tsx` (exceto `app/api`) ainda tem
corpo de tela elegível para mover: as candidatas restantes já são shells finos
ou adapters de host (`next-auth`, `next/navigation`, `next/image`, Prisma,
injeção de carrossel 3D / mapa). Nada foi movido para `packages/frontend`.
Vitest platform, arch-check e token-check **não** foram executados. PARE.

## Conferidas (46 `page.tsx` em `app/`, fora `app/api`)

### Já shells finos (~8–12 linhas: só import `@gb-locacoes/frontend` + return)

- `app/admin/categorias/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/email/page.tsx`
- `app/admin/equipamentos/page.tsx`
- `app/admin/equipamentos/novo/page.tsx`
- `app/admin/equipamentos/[id]/page.tsx`
- `app/admin/equipamentos/[id]/editar/page.tsx`
- `app/admin/financeiro/page.tsx`
- `app/admin/logistics/page.tsx`
- `app/admin/maintenance/page.tsx`
- `app/admin/orcamentos/page.tsx`
- `app/admin/orcamentos/[id]/page.tsx`
- `app/admin/permissions/page.tsx`
- `app/admin/rentals/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/whatsapp/page.tsx`
- `app/admin/teste-toast/page.tsx` (skip pedido)
- `app/api-docs/page.tsx` (skip pedido)
- `app/area-cliente/page.tsx`
- `app/area-cliente/enderecos/page.tsx`
- `app/area-cliente/historico/page.tsx`
- `app/area-cliente/historico/[id]/page.tsx`
- `app/area-cliente/notificacoes/page.tsx`
- `app/area-cliente/perfil/page.tsx`
- `app/cookies/page.tsx`
- `app/orcamento/page.tsx`
- `app/playground/page.tsx` (skip pedido)
- `app/playground/icon-customization/page.tsx` (skip pedido)
- `app/grid-motion/page.tsx` (skip pedido)
- `app/equipamentos-scroll/page.tsx` (skip pedido)
- `app/privacidade/page.tsx`
- `app/politica-devolucao/page.tsx`
- `app/recuperar-senha/page.tsx`
- `app/termos/page.tsx`

### Skip explícito / fora do escopo desta fatia

- `app/page.tsx` — home + Prisma (skip pedido)
- `app/ClientLayout.tsx` — não é `page.tsx` (skip pedido)
- Carrossel 3D — não tocado

### Restantes com mais de import+return — **não** são corpo de tela

| Rota                                          | Motivo de não mover                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app/equipamentos/[id]/page.tsx` (210 linhas) | Shell server: Prisma + `generateMetadata` + wiring para `EquipamentoDetalhePage` já em frontend. Prisma não entra no frontend universal. |
| `app/login/page.tsx`                          | Adapter host: `next-auth` + `useSearchParams` + Suspense; corpo já em `pages/login`.                                                     |
| `app/entrar/page.tsx`                         | Idem (`pages/entrar`).                                                                                                                   |
| `app/cadastro/page.tsx`                       | Idem (`pages/cadastro`).                                                                                                                 |
| `app/reset-password/page.tsx`                 | Idem (`pages/reset-password`).                                                                                                           |
| `app/auth/callback/page.tsx`                  | Adapter host: sessão NextAuth + redirect; UI em `pages/auth-callback`.                                                                   |
| `app/equipamentos/page.tsx`                   | Adapter host: Image/Link/searchParams (já documentado como shell em 263).                                                                |
| `app/admin/page.tsx`                          | Adapter host: sessão + redirect para `pages/admin-entrada`.                                                                              |
| `app/admin/login/page.tsx`                    | Adapter host: `router.replace` + `AdminLoginPage`.                                                                                       |
| `app/sobre/page.tsx`                          | Injeção do carrossel 3D (proibido tocar) + badge; corpo em `pages/sobre`.                                                                |
| `app/contato/page.tsx`                        | Injeção do mapa; corpo em `pages/contato` (já shell em 265).                                                                             |

```yaml
fatia:
  id: 297-rotas
  estado: bloqueado
  conceito: buscar até 2 page.tsx com corpo de tela → nenhuma elegível
  origem: []
  destino: []
  invariantes:
    - id: sem-movimento
      prova: "nenhum arquivo de produto alterado nesta fatia"
    - id: sem-carrossel-3d
      prova: "components/equipment-3d-carousel.tsx não tocado"
    - id: prisma-fica-no-host
      prova: "app/equipamentos/[id]/page.tsx permanece com Prisma no host"
  comandos: []
  gate:
    arch: skipped
    tokens: skipped
    vitest_platform: skipped
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "adapters host (login/entrar/cadastro/auth/equipamentos/sobre/contato)
        ainda usam next-auth/next/* no app/"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: Vitest platform — sem mudanças]"
    - "[NOT_VERIFIED: arch-check — sem mudanças]"
    - "[NOT_VERIFIED: token-check — sem mudanças]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
