# 269-equipment-card

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

Critério exclusivo: somente `components/ui/equipment-card.tsx` (e teste colado
ao lado, se existir).

Inventário em disco:

- `components/ui/equipment-card.tsx` — **ausente** (`Test-Path` = False)
- `components/ui/equipment-card.test.tsx` (ou similar ao lado) — **ausente**
- `components/equipment-card.tsx` — existe, mas **fora do escopo** desta fatia
  (não está em `components/ui/`)
- Não há reexport em `components/ui/` para este nome

Sem origem no caminho exclusivo. PARE conforme contrato da fatia.

```yaml
fatia:
  id: 269-equipment-card
  estado: bloqueado
  conceito: card de equipamento (UI)
  motivo:
    "components/ui/equipment-card.tsx não existe; o legado em
    components/equipment-card.tsx está fora do caminho exclusivo desta fatia"
  origem: []
  destino: []
  invariantes:
    - "não migrar components/equipment-card.tsx nesta fatia (caminho exclusivo é
      components/ui/)"
    - "não unir com CTA"
    - "não tocar em carrossel 3D, chart.tsx, package.json, prisma, MIGRATION.md,
      CHANGELOG.md"
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
