# 317 — Gates / varredura (lixo de agente)

Data: 2026-09-25

## Escopo desta fatia

Limpeza de scripts soltos de varredura/agente e conferência da rota mobile
`equipamentos` + exits reais de `arch-check` / `token-check`. Sem commit, sem
pnpm install, sem prisma. Não editados: `docs/migration/MIGRATION.md`,
`CHANGELOG.md`, nem os arquivos 3D/UI proibidos.

## 1) Lixo de varredura

Busca via `node` + `fs` (sem recurse PowerShell) em `packages/frontend`,
`tools/`, `apps/` e raiz, por nomes `_scan*`, `scan_*`, `_tmp*`, `_agent*`,
`_scratch*`.

### Encontrado e ações

| Arquivo                                    | Ação                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/_tmp-mig-tail.js`                   | **Apagado** — script temporário de agente (inspeção de fences/linhas de `MIGRATION.md`)                                                |
| `tools/_tmp-w30-23-tail.js`                | Já ausente no momento do unlink (apareceu na 1ª varredura)                                                                             |
| `tools/_tmp-*.cjs` (vários w30/mig)        | Apareceram numa 2ª varredura e já estavam ausentes no unlink seguinte (outro agente / corrida); ao final do escopo, **remaining = []** |
| `_scan_imports.js` em `pages/notificacoes` | **Não encontrado** — pasta só tem `contrato.migracao.test.ts`, `index.ts`, `ui/NotificacoesPage.web.tsx` (+ teste)                     |
| JS solto sob `packages/frontend`           | Nenhum                                                                                                                                 |

Preservados: `tools/arch-check.mjs`, `tools/token-check.mjs`, todos os
`contrato.migracao.test.ts`, código de produto.

Nota: `docs/migration/inbox/_tmp-w30-19-append.cjs` existe (lixo de outra
inbox). Não apagado — fora do escopo `packages/frontend` / `tools/` pedido.

### Arquivos apagados nesta fatia

- `tools/_tmp-mig-tail.js`

## 2) Rota mobile `equipamentos`

Arquivo: `apps/clients/mobile/src/app/equipamentos.tsx`

- Importa `EquipamentosPage` de `@gb-locacoes/frontend/pages/equipamentos`
  (export público do slice).
- Não importa `.web`, `next/*` nem prisma.
- Page no pacote é universal (`EquipamentosPage.tsx`, não `.web.tsx`).
- Padrão alinhado às outras telas mobile (ex.: `contato.tsx`).
- **Nenhuma correção necessária.**

## 3) Gates

Comandos (cwd do repo):

```
node tools/arch-check.mjs
node tools/token-check.mjs
```

### Exits reais (após limpeza)

| Gate              | Exit  | Observação                                          |
| ----------------- | ----- | --------------------------------------------------- |
| `arch-check.mjs`  | **0** | `architecture gate passed (5 packages)`             |
| `token-check.mjs` | **1** | Crash no próprio tooling (não em lixo de varredura) |

### Falha remanescente (`token-check`) — NÃO corrigida

- **Arquivo:** `tools/token-check.mjs` (linha ~115, função `checkCode`)
- **Mensagem:** `TypeError: Cannot read properties of undefined (reading 'JS')`
- **Detalhe:** `ts.ScriptKind` está `undefined` ao resolver kind
  (`ts.ScriptKind.JS` / TSX/JSX/TS).
- **Motivo de não corrigir:** falha no gate oficial / ambiente TypeScript, não
  em lixo `_scan` nem em slice desta fatia; fora do mandato de apagar só lixo
  óbvio.

Não houve segundo ciclo de limpeza+re-run por lixo causal: a falha restante não
é arquivo de varredura.

## 4) Status

Varredura de lixo em `tools/` + `packages/frontend` concluída para esta inbox.
Rota mobile ok. `arch-check` verde; `token-check` vermelho por crash interno do
script.

**Migração NÃO declarada concluída.**
