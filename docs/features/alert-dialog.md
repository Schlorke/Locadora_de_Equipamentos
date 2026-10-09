# Alert Dialog

> **Caminhos atuais (conferidos em 2026-09-30)**: `SmartQuoteButton` está em
> `packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx`
> (o `components/smart-quote-button.tsx` citado abaixo é o caminho antigo).

## Resumo

- Dialog de confirmacao usa Radix AlertDialog.
- Layout padrao com header, body e footer.
- Cantos arredondados em todos os breakpoints.

## Componentes e locais

- `packages/ui/src/web/AlertDialog.web.tsx`: wrapper e estilos base.
- `packages/frontend/src/widgets/cabecalho/ui/Sair.web.tsx`: confirmacao de
  saida.
- `components/smart-quote-button.tsx`: confirmacao de finais de semana.

## Comportamento esperado

- `AlertDialogContent` deve usar `rounded-2xl` e `overflow-hidden`.
- Header e footer usam `rounded-t-2xl` e `rounded-b-2xl`.
- No mobile, os cantos permanecem arredondados e o background nao deve vazar.
- Acoes usam `buttonVariants` para manter o design system.

## Como validar

1. Abrir o dialog de confirmacao de saida no mobile.
2. Confirmar que os cantos estao arredondados e sem vazamento visual.
3. Abrir o dialog de finais de semana e conferir a mesma estrutura.

## Observacoes

- Evite alterar cores dos botoes fora do `buttonVariants`.
- Ajustes visuais devem ser feitos no wrapper de `AlertDialog`.
