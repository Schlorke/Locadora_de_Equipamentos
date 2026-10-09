# 239 — debounce

Fatia exclusiva: `hooks/use-debounce.ts` → `packages/frontend/src/shared/lib`.
Sem unificar com `lib/utils.ts`. Estado intermediate — não declarar migração
concluída.

```yaml
fatia:
  id: 239-debounce
  estado: intermediate
  conceito: hook de debounce genérico (atraso em ms), sem regra de negócio
  origem:
    - hooks/use-debounce.ts
  destino:
    - packages/frontend/src/shared/lib/debounce.ts
    - packages/frontend/src/shared/lib/debounce.test.ts
    - packages/frontend/src/shared/lib/index.ts
    - packages/frontend/src/pages/orcamentos-admin/model/dados.web.ts
  invariantes:
    - id: atraso-padrao-350ms
      prova:
        "debounce.test.ts: export function useDebounce<T>(value: T, delay:
        number = 350): T"
    - id: sem-imports-plataforma
      prova:
        "debounce.test.ts: fonte sem next/, react-dom e react-native; só from
        'react'"
    - id: nao-unificado-utils
      prova: "lib/utils.ts debounce não foi tocado nesta fatia"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/shared/lib/debounce.test.ts"
      exit: 0
    - cmd: "node tools/arch-check.mjs"
      exit: 0
    - cmd: "node tools/token-check.mjs"
      exit: 0
  gate:
    arch: pass
    tokens: pass
    violacoes_conhecidas:
      - "listagem de orçamentos ainda vive em pages/orcamentos-admin (só a linha
        de import do debounce mudou)"
      - "app/ na raiz continua dono de produção"
  aposentado:
    - hooks/use-debounce.ts
  nao_verificado:
    - "[NOT_VERIFIED: debounce da busca no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
    - "[NOT_VERIFIED: pnpm bundle:mobile]"
    - "[NOT_VERIFIED: device_or_emulator]"
```
