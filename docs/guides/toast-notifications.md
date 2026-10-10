# Notificações temporárias: contrato compartilhado

A
[receita antiga](../archive/wave135-pre-f/docs/guides/toast-notifications.md.source)
foi preservada, incluindo a API que existia naquela documentação. O uso atual
consome `toast`, `useSonner` e `Toaster` da entrada pública `@gb-locacoes/ui`.

## Uso atual

```tsx
import { toast } from "@gb-locacoes/ui"

// Chamar depois de a operação real confirmar seu resultado.
const id = toast.success("Alteração salva", {
  description: "Os dados foram atualizados."
})

// Quando o fluxo precisar encerrar esta notificação específica:
// toast.dismiss(id);
```

O segundo argumento é um objeto de opções, não uma descrição passada como string
separada. Os tipos disponíveis incluem sucesso, erro, informação, aviso e
carregamento. Uma notificação de sucesso não substitui a confirmação do backend;
apresentar erro não autoriza repetir uma escrita de resultado incerto.

## Donos e montagem

- Web: `packages/ui/src/web/SonnerToaster.web.tsx` configura o Sonner e conserva
  as classes, ícones, cores por tipo, offset e duração existentes.
- Native: `packages/ui/src/native/SonnerToaster.native.tsx` renderiza o store de
  `packages/ui/src/contract/toast-store.ts` com tokens e tema native.
- Frontend: `packages/frontend/src/shared/lib/toast.web.ts` e `toast.native.ts`
  fazem a delegação de plataforma para os consumidores internos.
- Shell web: `packages/frontend/src/app/providers/ClientLayoutShell.web.tsx`
  monta `<Toaster />`; o host não deve criar uma segunda montagem por página.

No web a posição é superior central, abaixo do cabeçalho público ou do painel,
com os offsets já definidos na variante. Native possui sua própria apresentação
com tokens; compartilhar o contrato não declara igualdade de pixels entre DOM e
React Native. Não mudar cores, classes, offset, z-index ou animação para adaptar
um exemplo deste guia.

## Verificação

Exercitar uma operação real com sucesso e falha; conferir texto, descrição,
fechamento, ação/cancelamento e carregamento sem notificações duplicadas.
`packages/frontend/src/pages/teste-toast/ui/TesteToastPage.web.tsx` e a variante
native são as páginas de demonstração existentes. O teste colocado
`packages/ui/src/web/SonnerToaster.web.test.tsx` protege a composição web.

Consulte o [design system](../features/design-system.md) e o
[inventário](../COMPONENT_INVENTORY.md) antes de alterar apresentação. Esta
revisão não implementa a API antiga de hooks nem altera o produto.

_Atualizado em 2026-10-09; contrato e variantes conferidos no clone._
