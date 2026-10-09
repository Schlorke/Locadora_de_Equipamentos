# 285-dialogs

Fatia **bloqueada**. Nenhum código de produto foi alterado.

Critério exclusivo: até três arquivos `.tsx` ainda em `components/dialogs/` ou
`components/forms/` (sem procurar em `components/admin`).

Estado no disco (working tree):

- `components/forms/` — **ausente**
- `components/dialogs/` — **existe e está vazio** (0 arquivos `.tsx`)
- Os nove diálogos legados aparecem no `git status` como `D` (já deletados no
  working tree; destino FSD já existe em fatias anteriores)

Sem `.tsx` elegível para mover. PARE conforme contrato da fatia. Não abriu
`components/admin`. Gates (Vitest platform, arch-check, token-check) não foram
executados: não há movimento a validar.

```yaml
fatia:
  id: 285-dialogs
  estado: bloqueado
  conceito:
    até três diálogos/formulários legados em components/dialogs ou
    components/forms
  origem: []
  destino: []
  motivo_bloqueio: >-
    components/forms ausente; components/dialogs existe com 0 .tsx. Legados já
    deletados no working tree (git D); destinos FSD já em pages/orcamento,
    pages/categorias, pages/equipamentos-admin, widgets/cabecalho e
    widgets/personalizar-icone. Regra: se pastas não existirem ou estiverem
    vazias, bloquear e parar; não procurar em components/admin.
  invariantes:
    - "somente components/dialogs/** ou components/forms/** (.tsx)"
    - "não unificar diálogos parecidos"
    - "não tocar MIGRATION.md, CHANGELOG.md, prisma, carrossel 3D, package.json"
  comandos: []
  gate:
    arch: nao_aplicavel
    tokens: nao_aplicavel
    vitest_platform: nao_aplicavel
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: pnpm exec vitest run --config vitest.platform.config.ts]"
    - "[NOT_VERIFIED: node tools/arch-check.mjs]"
    - "[NOT_VERIFIED: node tools/token-check.mjs]"
```
