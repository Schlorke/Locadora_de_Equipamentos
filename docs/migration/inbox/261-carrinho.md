# 261-carrinho

Fatia **bloqueada**. Não há um único arquivo principal em `hooks/` ou `stores/`
cujo nome contenha `cart` disponível para mover.

Estado no disco (working tree):

- `stores/useCartStore.ts` — **ausente** (git: `deleted`, ainda rastreado no
  índice até commit de aposentadoria)
- `hooks/use-cart-notifications.ts` — **ausente** (deleted)
- `hooks/use-cart-sync.ts` — **ausente** (deleted)

O destino FSD já existe e está em uso:
`packages/frontend/src/features/carrinho/` (`model/carrinho.ts` exporta
`useCartStore`, persist `name: "gb-locacoes-cart"`). Busca em `*.ts`/`*.tsx` por
`@/stores/useCartStore` ou `stores/useCartStore` não encontra imports ativos.

Movimento já documentado em fatias anteriores do diário principal
(`55-carrinho`, `57-aposenta-loja-carrinho`, `58-aviso-carrinho`,
`59-sincronia-carrinho`). Esta fatia 261 não reabre esse trabalho e **não move
vários** arquivos.

Nenhum código de produto foi alterado. Gates (Vitest platform, arch-check,
token-check) não foram executados: não há movimento a validar.

```yaml
fatia:
  id: 261-carrinho
  estado: bloqueado
  conceito: hook ou store do carrinho (nome com cart)
  origem: []
  destino: []
  motivo_bloqueio: >-
    Sem arquivo único claro em hooks/ ou stores/ com "cart" no nome.
    stores/useCartStore.ts e hooks use-cart-* já estão deleted no working tree;
    a loja vive em packages/frontend/src/features/carrinho (persist
    gb-locacoes-cart). Regra da fatia: se não achar um único arquivo claro,
    bloquear e parar; não mover vários.
  invariantes:
    - chave_persistencia: gb-locacoes-cart
    - precos: nao_alterados
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
