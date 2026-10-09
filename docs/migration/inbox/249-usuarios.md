# 249-usuarios

Fatia **bloqueada**. Não existe tela de produto em `app/admin/usuarios/**` nem
em `app/admin/users/**` (zero arquivos; também ausentes da lista de URLs em
`docs/migration/00-plano.md` e do inventário de pastas em `app/admin/`). Nenhum
movimento para `packages/frontend`, rota shell, Vitest, arch-check ou
token-check foi executado. PARE conforme contrato da fatia.

```yaml
fatia:
  id: 249-usuarios
  estado: bloqueado
  conceito: usuários admin
  origem:
    - app/admin/usuarios/**
    - app/admin/users/**
  destino: []
  motivo_bloqueio: >-
    Caminhos de origem inexistentes no repositório; fatia exclusiva sem fonte
    para migrar. Papéis ADMIN, FINANCIAL, OPERATOR e CLIENT permanecem intactos
    (não houve alteração). Não confundir com permissions (outro agente).
  invariantes: []
  comandos: []
  gate:
    arch: skipped
    tokens: skipped
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: tela /admin/usuarios ou /admin/users]"
    - "[NOT_VERIFIED: pnpm exec vitest platform]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
