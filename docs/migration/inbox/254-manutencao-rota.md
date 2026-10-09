# 254-manutencao-rota

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

A origem pedida `app/admin/manutencao/page.tsx` não existe. A URL de produto é
`/admin/maintenance` (`docs/migration/00-plano.md`).
`app/admin/maintenance/page.tsx` já é shell fino: só importa e renderiza
`AdminMaintenancePage` de `@gb-locacoes/frontend/pages/manutencao`. Não há
`loading.tsx` em `app/admin/maintenance/`.

O slice `packages/frontend/src/pages/manutencao` já é a tela inteira (carga,
filtros, tabela, diálogo, formatador próprio de manutenção). O formatador
permanece em `pages/manutencao/ui/formatar.tsx`, separado do de locação. A
migração equivalente já consta nas fatias do slice (ex.: ManutencaoPage, carga,
Tabela, Filtros, Dialogo, tipos, formatar).

```yaml
fatia:
  id: 254-manutencao-rota
  estado: bloqueado
  conceito: manutenção administrativa (shell /admin/maintenance)
  motivo: "rota já é shell; pages/manutencao já é a tela inteira"
  origem:
    - app/admin/maintenance/page.tsx
  destino:
    - packages/frontend/src/pages/manutencao
  invariantes:
    - "formatador de manutenção continua separado do de locação"
    - "URL /admin/maintenance permanece"
  comandos: []
  gate:
    arch: n/a
    tokens: n/a
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: arch-check — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fatia bloqueada sem mudança]"
```
