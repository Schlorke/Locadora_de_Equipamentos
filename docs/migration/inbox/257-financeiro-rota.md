# 257-financeiro-rota

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

`app/admin/financeiro/page.tsx` já é shell fino: só importa e renderiza
`AdminFinanceiroPageWrapper` de `@gb-locacoes/frontend/pages/financeiro`. O
slice `packages/frontend/src/pages/financeiro` já existe (carga, painel,
cartões, tabela, filtro, alíquotas, detalhe, exclusões). PARE conforme contrato
da fatia.

Não unir o diálogo de reajuste embutido em `Detalhe.web.tsx` com o de
orçamentos. Taxas, CNI e bugs documentados permanecem no slice existente, sem
toque nesta fatia.

```yaml
fatia:
  id: 257-financeiro-rota
  estado: bloqueado
  conceito: rota admin financeiro (shell /admin/financeiro)
  motivo:
    "rota já é shell (AdminFinanceiroPageWrapper); pages/financeiro já é a tela"
  origem:
    - app/admin/financeiro/page.tsx
  destino:
    - packages/frontend/src/pages/financeiro
  invariantes:
    - "não unir diálogo de reajuste de Detalhe.web.tsx com
      pages/orcamentos-admin"
    - "preservar taxas, CNI e bugs documentados no slice existente"
  comandos: []
  gate:
    arch: n/a
    tokens: n/a
    vitest_platform: n/a
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: arch-check — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fatia bloqueada sem mudança]"
```
