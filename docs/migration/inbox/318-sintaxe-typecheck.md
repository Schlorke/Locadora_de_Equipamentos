# 318-sintaxe-typecheck

Corrigir somente erros de sintaxe em CatalogPage, Expandidos.web, Graficos.web e
ScrollStackBenefitCard.web. Sem commit, sem `pnpm install`, sem Prisma. Sem
editar `docs/migration/MIGRATION.md` nem `CHANGELOG.md`.

```yaml
fatia:
  id: 318
  estado: intermediate
  conceito: >-
    restaurar sintaxe válida nos quatro arquivos de packages/frontend reportados
    pela 315 (TS1381/TS1005/JSX); não declarar migração concluída
  causa: >-
    a 315 listou sintaxe quebrada nesses quatro arquivos; no disco, no momento
    desta fatia, os quatro já estavam com JSX/TS balanceado e sem diagnósticos
    de parse TS1xxx no typecheck
  arquivos_editados: []
  caminhos_reais:
    - packages/frontend/src/pages/catalog/ui/CatalogPage.tsx
    - packages/frontend/src/pages/dashboard/ui/Expandidos.web.tsx
    - packages/frontend/src/pages/dashboard/ui/Graficos.web.tsx
    - packages/frontend/src/widgets/por-que-escolher/ui/ScrollStackBenefitCard.web.tsx
  verificacao_sintaxe:
    - >-
      tsc nos quatro arquivos (jsx react-jsx): 0 erros TS1xxx de sintaxe
    - >-
      cadeia typecheck: 0 hits de erro contendo CatalogPage, Expandidos.web,
      Graficos.web ou ScrollStackBenefitCard
    - braces/parens balanceados (node fs); arquivos untracked (??)
  correcoes:
    - >-
      nenhuma edição necessária — sintaxe já válida; não inventou tela nem
      alterou texto/cor/regra/telefone/status
  comandos:
    - cmd: node (fs walk) localizar nomes dos quatro arquivos
      exit: 0
      verificado_em: "2026-09-25 17:19"
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.json
        --pretty false
      exit: 0
      verificado_em: "2026-09-25 17:22"
      nota: EXIT_UI_WEB=0
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/ui/tsconfig.native.json
        --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:22"
      nota: EXIT_UI_NATIVE=1; 61 erros (56x Cannot find module 'react-native')
    - cmd: >-
        node node_modules/typescript/bin/tsc -p packages/frontend/tsconfig.json
        --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:22"
      nota: >-
        EXIT_FRONTEND=1; 217 erros; 0 nos quatro alvos; 0 TS1xxx; 1x
        react-native em Cartao.native.tsx (não corrigido)
    - cmd: >-
        node node_modules/typescript/bin/tsc -p apps/clients/web/tsconfig.json
        --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:22"
      nota: EXIT_WEB=1; 195 erros; 0 nos quatro alvos
    - cmd: >-
        node node_modules/typescript/bin/tsc -p
        apps/clients/mobile/tsconfig.json --pretty false
      exit: 1
      verificado_em: "2026-09-25 17:22"
      nota: EXIT_MOBILE=1; 418 erros; inclui native react-native
    - cmd: node tools/arch-check.mjs
      exit: nao_rodado
      nota: sem edição em packages/ ou apps/
    - cmd: node tools/token-check.mjs
      exit: nao_rodado
      nota: proibido nesta fatia (crash ScriptKind.JS noutro agente)
  erros_que_ficaram:
    - arquivo: packages/ui/src/native/*.native.tsx (vários)
      mensagem: >-
        TS2307 Cannot find module 'react-native' (+ implícitos any derivados)
      escopo: fora — NÃO corrigir / não instalar react-native
    - arquivo: packages/frontend/src/widgets/cartao-equipamento/ui/Cartao.native.tsx
      mensagem: TS2307 Cannot find module 'react-native'
      escopo: fora — anotar apenas
    - arquivo: packages/frontend (demais, ~217)
      mensagem: >-
        majoritariamente TS2307 @/lib/*, exports @gb-locacoes/ui ausentes
        (Alert), session user.id/role, CategoriaDialog implícitos any, Calendar
        fromDate, etc. — sem TS1xxx
      escopo: fora dos quatro arquivos — listado e parado
    - arquivo: apps/clients/web (+ legado components/)
      mensagem: >-
        ~195 erros (incl. equipment-3d-carousel imports e eco do frontend)
      escopo: fora
  nao_fez:
    - editar docs/migration/MIGRATION.md ou CHANGELOG.md
    - pnpm install / instalar react-native
    - prisma migrate/push/seed
    - editar os quatro alvos (já válidos)
    - tocar carrossel 3D, FilterSelectGroup, HoverActionMenu, token-check
    - commit
  bloqueio_restante:
    typecheck: >-
      exit 1 na cadeia (UI web OK; native react-native + frontend aliases/tipos
      + hosts ainda falham). Os quatro arquivos de sintaxe desta fatia não
      aparecem mais nos erros.
  migracao_concluida: false
```
