# 296-date-range

O legado `components/ui/date-range-picker.tsx` já não tinha imports de produto
apontando para o caminho antigo. A API observável (`DateRangePickerProps` +
defaults) é a mesma do widget `packages/frontend/src/widgets/seletor-data`
(`DateRangePicker` / `DateRangePickerProps` no `index`). Diferença só de wiring
interno: `Calendar` → `./Calendario.web`, `Popover` → `@gb-locacoes/ui`, `toast`
→ `shared/lib`. Placeholder continua `Selecionar período`; formato `dd/MM/yyyy`;
`mode="range"`; toasts guiadas e `showOutsideDays={false}` inalterados.
`EmailAdminPage` já importa o index do widget. Legado apagado. Estado
intermediate; migração não concluída.

```yaml
fatia:
  id: 296-date-range
  estado: intermediate
  conceito: DateRangePicker de components/ui para widgets/seletor-data
  origem:
    - components/ui/date-range-picker.tsx
  destino:
    - packages/frontend/src/widgets/seletor-data/index.ts
    - packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.tsx
    - packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.test.tsx
    - packages/frontend/src/pages/email-admin/ui/EmailAdminPage.web.tsx
  invariantes:
    - id: props-observaveis
      prova:
        "DateRangePickerProps e defaults (placeholder Selecionar período,
        disabled false, showClearButton true, showGuidedToasts false) iguais ao
        HEAD do legado"
    - id: textos-periodo
      prova:
        "DateRangePicker.web.test.tsx: Selecionar período, dd/MM/yyyy, mode
        range, data final, sucesso, Período mínimo, showOutsideDays false"
    - id: import-index
      prova:
        "EmailAdminPage.web.tsx importa DateRangePicker de
        ../../../widgets/seletor-data"
    - id: sem-legado
      prova:
        "rg date-range-picker em *.ts/*.tsx de produto = 0; arquivo
        components/ui/date-range-picker.tsx ausente"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 16:23"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:23"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:23"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "docs/issues e CHANGELOG ainda citam o caminho legado (fora do escopo
        296)"
      - "Calendario.web do seletor-data não foi alterado nesta fatia"
      - "carrossel 3D não foi tocado"
  aposentado:
    - components/ui/date-range-picker.tsx
  nao_verificado:
    - "[NOT_VERIFIED: filtro de período no /admin/email no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
