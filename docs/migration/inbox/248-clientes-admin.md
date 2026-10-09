# 248-clientes-admin

Fatia **bloqueada**. Não existe tela de produto em `app/admin/clientes/**` (zero
arquivos; pasta ausente em `app/admin/`; também ausente da lista de URLs em
`docs/migration/00-plano.md`). Nenhum movimento para `packages/frontend`, rota
shell, Vitest, arch-check ou token-check foi executado. PARE conforme contrato
da fatia.

```yaml
fatia:
  id: 248-clientes-admin
  estado: bloqueado
  conceito: clientes admin
  origem:
    - app/admin/clientes/**
  destino: []
  motivo_bloqueio: >-
    Caminho de origem inexistente no repositório; fatia exclusiva sem fonte para
    migrar. Pastas presentes em app/admin/: categorias, dashboard, email,
    equipamentos, financeiro, login, logistics, maintenance, orcamentos,
    permissions, rentals, settings, teste-toast, whatsapp.
  invariantes: []
  comandos: []
  gate:
    arch: skipped
    tokens: skipped
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: tela /admin/clientes]"
    - "[NOT_VERIFIED: pnpm exec vitest platform]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
