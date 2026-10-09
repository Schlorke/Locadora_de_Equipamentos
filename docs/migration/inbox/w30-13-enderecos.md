# w30-13 — pages/enderecos

- **Índice:** 13
- **Escopo:** `packages/frontend/src/pages/enderecos`
- **Estado:** intermediate

## O que mudou

- Criado `contrato.migracao.test.ts` afirmando o export público `EnderecosPage`
  no `index.ts` do slice.
- Nenhum arquivo de produção alterado.

## Imports legados

- `ui/EnderecosPage.web.tsx` importa `fetchAddressByCEP` de
  `../../../../../../lib/utils/validation`.
- O alvo **ainda existe** em `lib/utils/validation.ts` → **não reescrito**
  (regra: não trocar se o alvo existir).
- Não há match único de basename `validation` em `packages/frontend` nem
  `packages/ui` para remapeamento futuro.
- Demais imports (`@gb-locacoes/ui`, `features/selo-area-cliente`) estão ok no
  FSD.

## Mobile

- Página é `.web` (`EnderecosPage.web.tsx`) e usa `next-auth/react` → **não**
  criada tela fina em `apps/clients/mobile`.

## Exits

- Import legado para `lib/utils/validation` permanece até o util migrar para
  `packages/` com index público exportando `fetchAddressByCEP`.
- Já existia `ui/EnderecosPage.web.test.tsx` (caracterização); contrato de
  migração é complementar, não duplicata.
- Migração do slice **não** declarada como concluída.
