# Ícones personalizados compartilhados

Os ícones pertencem ao design system e são consumidos por sua entrada pública. A
[receita anterior](../archive/wave135-pre-f/docs/guides/custom-icons.md.source),
com pastas e comandos da implementação aposentada, foi preservada para consulta.

## Fontes atuais

- `packages/ui/src/icons/custom-model.ts`: nomes, props e dados dos desenhos.
- `packages/ui/src/icons/custom.web.tsx`: renderização SVG da variante web.
- `packages/ui/src/icons/custom.native.tsx`: renderização com
  `react-native-svg`.
- `packages/ui/src/index.web.ts` e `index.native.ts`: APIs públicas do pacote.
- `packages/frontend/src/shared/lib/constants/all-icons.web.tsx` e
  `all-icons.native.tsx`: catálogo utilizado pelo frontend, unindo os ícones
  personalizados aos disponíveis para categorias.

Um consumidor do design system importa componentes e catálogo de
`@gb-locacoes/ui`, por exemplo:

```tsx
import { AndaimeSuspenso } from "@gb-locacoes/ui"

;<AndaimeSuspenso size={24} color="currentColor" />
```

O catálogo interno do frontend não é uma nova entrada pública do pacote. Fatias
FSD usam sua fonte em `shared` por import relativo adequado à posição do
arquivo; os hosts não importam esse detalhe interno.

## Ao acrescentar um desenho autorizado

1. Conferir o catálogo em `packages/ui/src/catalog.ts` e o
   [inventário](../COMPONENT_INVENTORY.md), evitando um segundo ícone
   equivalente.
2. Manter os dados do desenho em `custom-model.ts` e as duas renderizações
   platformais sobre o mesmo contrato. Preservar as props `size`, `color` e
   `className` existentes, sem criar cores ou dimensões globais novas.
3. Atualizar as APIs públicas web/native quando o desenho precisar ser consumido
   fora do pacote e o catálogo de seleção quando houver esse requisito.
4. Validar o desenho real nas duas plataformas e os gates de arquitetura/tokens.
   Os testes colocados, como `custom.web.test.tsx`, protegem apenas seu escopo.

`scripts/convert-svg-to-icon.cjs` ainda é um utilitário antigo: sua saída
orienta um destino que foi aposentado e cria um `.component.txt` no diretório do
script. Ele não atualiza o modelo canônico nem a variante native. Não representa
um pipeline de geração atual; estudar sua conversão não autoriza executá-lo no
checkout ou copiar somente uma variante para substituir o contrato
compartilhado.

Consulte o [design system](../features/design-system.md) antes de alterar
estilos. Esta revisão documental não adiciona ícones nem modifica SVG, cores ou
layout.

_Atualizado em 2026-10-09; fontes conferidas no clone pós-retirada._
