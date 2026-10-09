# 315-typecheck-ui

Typecheck de `packages/ui` — corrigir só FilterSelectGroup e HoverActionMenu.
Sem commit, sem `pnpm install`, sem Prisma. Sem editar
`docs/migration/MIGRATION.md` nem `CHANGELOG.md`. Sem tocar em
`packages/frontend`, `apps/clients`, carrossel 3D ou rotas.

```yaml
fatia:
  id: 315
  estado: intermediate
  conceito: >-
    corrigir erros de typecheck conhecidos em packages/ui (FilterSelectGroup
    @/types/filters + option any; HoverActionMenuProps conflito
    children/onClick); não declarar migração concluída
  causa: >-
    FilterSelectGroup importava @/types/filters (alias inválido em packages/ui),
    deixando option implícito any; HoverActionMenuProps estendia
    ButtonHTMLAttributes e o contrato com children/onClick incompatíveis
  arquivos_editados:
    - packages/ui/src/contract/filter-select-group.ts
    - packages/ui/src/web/FilterSelectGroup.web.tsx
    - packages/ui/src/web/HoverActionMenu.web.tsx
  correcoes:
    - >-
      copiou Filter/FilterOption mínimos para
      packages/ui/src/contract/filter-select-group.ts (sem mover
      types/filters.ts legado)
    - FilterSelectGroup passa a importar o contrato local
    - >-
      HoverActionMenuProps omite children|onClick de ButtonHTMLAttributes,
      alinhando ao contrato compartilhado
  comandos:
    - cmd: .\node_modules\.bin\tsc.CMD -p packages/ui/tsconfig.json
      exit: 0
      verificado_em: "2026-09-25 17:18"
      nota: erros alvo (FilterSelectGroup + HoverActionMenu) resolvidos
    - cmd: >-
        cadeia typecheck (ui web + ui native + frontend + web host + mobile
        host) via .\node_modules\.bin\tsc.CMD -p …
      exit: 1
      verificado_em: "2026-09-25 17:18"
      nota: >-
        EXIT_UI_WEB=0; falhas restantes fora dos dois arquivos alvo (não
        corrigidas nesta fatia)
    - cmd: node tools/arch-check.mjs
      exit: 0
      verificado_em: "2026-09-25 17:18"
    - cmd: node tools/token-check.mjs
      exit: 1
      verificado_em: "2026-09-25 17:18"
      nota: >-
        TypeError no próprio tools/token-check.mjs (ts.ScriptKind.JS undefined)
        — não ligado às edições desta fatia
  erros_que_ficaram:
    - arquivo: packages/ui/src/native/*.native.tsx (vários)
      mensagem: >-
        TS2307: Cannot find module 'react-native' or its corresponding type
        declarations. (+ alguns TS7006/TS7031 implícitos any derivados)
      escopo: fora — ui native / ambiente sem types react-native
    - arquivo: packages/frontend/src/pages/catalog/ui/CatalogPage.tsx
      mensagem: >-
        TS1381: Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
      escopo: fora — packages/frontend (outros agentes)
    - arquivo: packages/frontend/src/pages/dashboard/ui/Expandidos.web.tsx
      mensagem: "TS1005: '...' expected."
      escopo: fora — packages/frontend
    - arquivo: packages/frontend/src/pages/dashboard/ui/Graficos.web.tsx
      mensagem: "TS1005: '...' expected."
      escopo: fora — packages/frontend
    - arquivo: >-
        packages/frontend/src/widgets/por-que-escolher/ui/
        ScrollStackBenefitCard.web.tsx
      mensagem: >-
        TS1005/TS1136/TS1381/TS1382 (sintaxe JSX quebrada em vários pontos)
      escopo: fora — packages/frontend
  nao_fez:
    - editar docs/migration/MIGRATION.md ou CHANGELOG.md
    - pnpm install
    - prisma migrate/push/seed
    - corrigir erros fora de FilterSelectGroup / HoverActionMenu
    - editar packages/frontend / apps/clients / carrossel 3D / rotas
    - mover types/filters.ts legado da raiz
    - commit
  bloqueio_restante:
    typecheck: >-
      exit 1 — packages/ui web OK; native (react-native types) +
      packages/frontend (páginas/widgets em edição paralela) ainda falham; hosts
      não limpos
    token-check: >-
      exit 1 — crash interno do script (ScriptKind.JS undefined)
  migracao_concluida: false
```
