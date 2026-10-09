# 329-app-raiz-telas

Varredura com `node` `fs` (sem recurse PowerShell) de `app/**/page.tsx` fora de
`app/api`: **46** pages. Critério de tela gorda = markup de produto na rota;
shell fino / adaptador de host = import de `@gb-locacoes/frontend/pages/*` +
Prisma / next-auth / `generateMetadata` / Suspense local / injeção de slot
(carrossel, social, Image, Link, mapa, StructuredData).

**Pages que NÃO são shell fino:** nenhuma (lista vazia).

Candidatas por heurística ingênua (Suspense fallback / slots) reclassificadas
como adaptador de host após leitura:

- `app/cadastro/page.tsx` — Suspense local + `signIn` → `CadastroPage`
- `app/entrar/page.tsx` — Suspense local + `signIn`/`getSession` → `EntrarPage`
- `app/login/page.tsx` — Suspense local + slot social (`@gb-locacoes/ui`) →
  `LoginPage`
- `app/equipamentos/[id]/page.tsx` — Prisma + `generateMetadata` + slot
  StructuredData → `EquipamentoDetalhePage`

Nada movido. `app/` intacto (API + rotas). Pasta `hooks/` estava vazia e foi
removida com `fs.rmdirSync` (não é tela). Carrossel 3D não tocado. `pnpm tokens`
e `pnpm arch` exit 0. Estado intermediate. Migração **não** concluída.

```yaml
fatia:
  id: 329-app-raiz-telas
  estado: intermediate
  conceito: >-
    inventário app/**/page.tsx (fora api) via node fs; classificar shell vs tela
    gorda; mover um grupo só se houver tela; senão só gates
  origem:
    - app/**/page.tsx (exceto app/api)
  destino: []
  movido: []
  pages_total: 46
  pages_shell: 46
  pages_tela: 0
  pages_nao_shell: []
  lido_antes:
    - docs/ai/boot.md
    - docs/migration/inbox/328-host-reveal-sw.md
    - app/cadastro/page.tsx
    - app/entrar/page.tsx
    - app/login/page.tsx
    - app/equipamentos/[id]/page.tsx
    - app/page.tsx
    - app/sobre/page.tsx
  invariantes:
    - id: sem-mover-sem-tela
      prova: "pages_tela=0; movido=[]; app/ page.tsx não alterados nesta fatia"
    - id: sem-apagar-app
      prova: "app/ da raiz permanece (API + rotas); sem catch-all novo"
    - id: carrossel-3d-intacto
      prova:
        "não alterou Equipment3DCarousel/ModelViewer maxDuration 0 /
        disableAutoFit / hasPassedFirstModel / scrollRevealReady"
    - id: hooks-vazio
      prova: "hooks/ sem arquivos; fs.rmdirSync só porque vazia"
  comandos:
    - cmd: "node (walk fs app/**/page.tsx excl. api)"
      exit: 0
    - cmd: "pnpm tokens"
      exit: 0
    - cmd: "pnpm arch"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/ da raiz continua o servidor Next de produção (API + rotas)"
  aposentado:
    - hooks/ (pasta vazia)
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm test — falta TEST_DATABASE_URL]"
    - "[NOT_VERIFIED: browser]"
    - "[NOT_VERIFIED: device_or_emulator]"
    - "[NOT_VERIFIED: cobertura]"
  nao_fez:
    - pnpm install
    - prisma migrate/seed
    - inventar TEST_DATABASE_URL
    - pnpm test
    - pnpm build
    - mover page/slice (todas shell/adaptador)
    - apagar app/ da raiz
    - alterar lógica do carrossel 3D
    - recriar catch-all
  migracao_concluida: false
```
