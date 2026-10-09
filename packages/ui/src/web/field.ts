/**
 * Molduras dos controles de formulário do design system. Os valores vêm dos tokens (packages/design-tokens/src/
 * tokens.css): as cores pela ponte @theme da entrada do CSS (border-field…) e as sombras pelos utilitários de
 * packages/frontend/src/app/styles/utilities.web.css (shadow-control…).
 *
 * Os componentes aplicam a moldura DEPOIS do className do consumidor (`cn(base, className, FIELD_FRAME)`): a
 * moldura é do componente, como era quando vinha da regra global de campos, e o consumidor ajusta tamanho,
 * espaçamento e tipografia. Estado de erro de validação: o atributo `aria-invalid` no campo (FormControl já o grava),
 * nunca uma borda solta como `border-red-500`, que a moldura apaga.
 */

/** Campo em erro de validação (aria-invalid="true"): borda vermelha do token --field-invalid e, no foco, o halo
 * vermelho no lugar do azul. Fecha as três molduras de campo. */
export const FIELD_INVALID =
  "aria-invalid:border-field-invalid aria-invalid:focus:border-field-invalid aria-invalid:focus:shadow-control-invalid-focus";

/** Campo (Input, CurrencyInput, SelectTrigger): borda cinza, sombra que cresce no hover e, no foco, borda azul com
 * halo de 3px no lugar do contorno. Sem contorno no foco, nem o anel do navegador no foco por teclado, nem nas cores
 * forçadas (a regra global `outline: none` da produção): focus:outline-hidden tira o estilo e focus:outline-0 a
 * largura (outline-0 sozinho só dá a largura, como no Tailwind 3; o anel `auto` do navegador continuaria). */
export const FIELD_FRAME = [
  "border-field shadow-control transition-all duration-200 hover-always:not-focus:shadow-control-hover focus:border-field-focus focus:shadow-control-focus focus:outline-hidden focus:outline-0",
  FIELD_INVALID,
].join(" ");

/** Controle de filtro do painel (busca e seletor da barra de filtros): a moldura do campo nos tons dos tokens
 * legados, com transição suave nos dois sentidos (a curva ease-in-out da CSS, como a regra global da produção; a
 * classe ease-in-out do Tailwind é outra curva e também mexe na animação). */
export const FILTER_FIELD_FRAME = [
  "border-field-legacy shadow-control transition-all duration-200 [transition-timing-function:ease-in-out] hover-always:not-focus:shadow-control-hover focus:border-field-legacy-focus focus:shadow-control-focus focus:outline-hidden focus:outline-0 focus:outline-offset-0",
  FIELD_INVALID,
].join(" ");

/** Área de texto: sombra baixa em repouso, sombra elevada no hover e o foco dos campos. */
export const TEXTAREA_FRAME = [
  "border-field-legacy shadow-textarea transition-all duration-200 [transition-timing-function:ease] hover-always:not-focus:shadow-raised focus:border-field-legacy-focus focus:shadow-control-focus focus:outline-0",
  FIELD_INVALID,
].join(" ");

/**
 * Cartão da barra de filtros do painel: camada própria sobre o conteúdo vizinho, sem borda nem contorno em nenhum modo
 * (nas cores forçadas, forced-colors:outline-0 zera a largura do sólido transparente do outline-hidden). O z-index
 * vem da classe admin-filter-card (token --layer-step, em packages/frontend/src/app/styles/layout.web.css).
 */
export const FILTER_CARD =
  "admin-filter-card relative isolate contain-layout will-change-transform transform-gpu border-none outline-hidden forced-colors:outline-0 shadow-raised-xl";
