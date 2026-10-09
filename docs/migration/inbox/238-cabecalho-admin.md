# 238-cabecalho-admin

O cabeçalho das páginas admin saiu de `components/admin/admin-page-header.tsx`
para o widget `cabecalho-admin`. O arquivo legado foi apagado após confirmação
de que nenhum `.ts`/`.tsx` ainda o importava. O gradiente laranja e o `y: -20`
da animação de entrada permanecem. Esta fatia está em estado intermediate; a
migração não está concluída.

```yaml
fatia:
  id: 238-cabecalho-admin
  estado: intermediate
  conceito: cabeçalho das páginas admin
  origem:
    - components/admin/admin-page-header.tsx
  destino:
    - packages/frontend/src/widgets/cabecalho-admin/ui/Cabecalho.tsx
  invariantes:
    - id: gradiente-e-entrada
      prova:
        "Cabecalho.test.tsx: from-orange-500 via-orange-600 to-orange-700 e y:
        -20"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/widgets/cabecalho-admin/ui/Cabecalho.test.tsx
        packages/frontend/src/pages/orcamentos-admin/ui/Lista.web.test.tsx"
      exit: 0
      verificado_em: "2026-09-25 15:48"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:48"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 15:48"
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
      - "hooks/use-debounce.ts continua legado e ainda é usado pela listagem"
  aposentado:
    - components/admin/admin-page-header.tsx
  nao_verificado:
    - "[NOT_VERIFIED: cabeçalho admin no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
