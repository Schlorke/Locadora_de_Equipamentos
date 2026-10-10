# Autocomplete: posicionamento web e limites da prova iOS

O incidente de 27/10/2025, as alternativas avaliadas e a matriz de dispositivos
da época foram preservados no
[registro histórico](../archive/wave135-pre-f/docs/guides/safari-ios-autocomplete-positioning-fix.md.source).
Essa matriz não certifica uma execução atual em Safari/iPhone.

## Implementação atual

O componente web é `packages/ui/src/web/Autocomplete.web.tsx`, consumido por
`@gb-locacoes/ui`. A variante React Native fica em
`packages/ui/src/native/Autocomplete.native.tsx`; ela não executa o mesmo
posicionamento DOM do navegador.

O web identifica iPad/iPhone/iPod depois do mount. Quando o dropdown está aberto
e o componente montado, o ramo iOS usa posicionamento absoluto no container
relativo, abaixo do campo, sem portal. Os demais navegadores usam portal no
documento e posicionamento fixo calculado pelo retângulo do input. Os listeners
de scroll/resize e o comportamento de fechamento pertencem a esse componente.

`apps/clients/web/src/app/layout.tsx` mantém `suppressHydrationWarning` no
HTML/body; o Autocomplete também o usa nos containers existentes. Essa supressão
não conserta um dropdown mal posicionado e não deve ser ampliada para esconder
uma divergência nova de SSR. O catálogo atual está em
`packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.web.tsx`; ele não
é uma cópia de referência a ser transplantada para o Autocomplete.

## Validar uma alteração

1. No aparelho real, abrir a vitrine da locadora e buscar um equipamento da
   fixture autorizada. Conferir a listbox abaixo do campo com o teclado aberto.
2. Repetir com a barra do navegador expandida/recolhida, após scroll e ao trocar
   orientação. Conferir seleção, fechamento externo e scroll das sugestões.
3. Repetir no desktop para preservar o ramo com portal, teclado e seleção.
4. Registrar separadamente o ambiente/dispositivo e erros de hidratação. A
   emulação de viewport ou um teste DOM não substitui a evidência iOS real.

`Autocomplete.web.test.tsx` e `Autocomplete.native.test.tsx`, colocados ao lado
das variantes, caracterizam seus comportamentos locais. Os
[contratos do design system](../features/design-system.md) continuam válidos:
não criar z-index, cores, overrides ou uma segunda implementação para conseguir
uma captura verde. Esta atualização documental não modifica os estilos
existentes nem declara uma validação em aparelho novo.

_Atualizado em 2026-10-09; donos conferidos por leitura no clone._
