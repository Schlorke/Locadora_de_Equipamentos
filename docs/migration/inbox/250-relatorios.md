# 250-relatorios

Fatia **bloqueada**. Não existe tela de produto em `app/admin/relatorios/**` nem
em `app/admin/reports/**` (zero arquivos; também ausentes da lista de URLs em
`docs/migration/00-plano.md`). Nenhum movimento para `packages/frontend`, rota
shell, Vitest, arch-check ou token-check foi executado. PARE conforme contrato
da fatia.

```yaml
fatia:
  id: 250-relatorios
  estado: bloqueado
  conceito: relatórios admin
  origem:
    - app/admin/relatorios/**
    - app/admin/reports/**
  destino: []
  motivo_bloqueio: >-
    Caminhos de origem inexistentes no repositório; fatia exclusiva sem fonte
    para migrar. Não confundir com analytics (outro agente) nem com
    reports/performance (Lighthouse).
  invariantes: []
  comandos: []
  gate:
    arch: skipped
    tokens: skipped
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: tela /admin/relatorios ou /admin/reports]"
    - "[NOT_VERIFIED: pnpm exec vitest platform]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
