import { MENU_FOCUS_RING } from "./focus-ring";

/**
 * Moldura de um gatilho (Accordion, Collapsible, Popover, diálogos, gaveta, NavigationMenu) enquanto ele controla o
 * conteúdo aberto (`aria-controls`, variante `controls:` de styles/utilities.web.css): borda e sombra dos campos
 * e, no foco, borda azul e halo de 3px; no foco por teclado, também o anel do navegador em azul com 2px (as classes
 * dão largura e cor, o estilo vem do navegador, como na produção; styles/outline.web.css). Com asChild a classe passa
 * ao filho pelo Slot do Radix.
 */
export const TRIGGER_FRAME =
  "controls:border-field controls:shadow-control controls:transition-all controls:duration-200 controls:hover-always:not-focus:shadow-control-hover controls:focus:border-field-focus controls:focus:shadow-control-focus controls:focus:outline-2 controls:focus:outline-field-focus";

/**
 * Gatilho de menu (DropdownMenu, Menubar): a mesma moldura enquanto o menu está aberto, sem sombra no foco e com o
 * anel de foco só pelo teclado (MENU_FOCUS_RING).
 */
export const MENU_TRIGGER_FRAME = [
  "controls:border-field controls:shadow-control controls:transition-all controls:duration-200 controls:hover-always:not-focus:shadow-control-hover controls:focus:border-field-focus",
  "focus:[box-shadow:none] focus:outline-0 controls:focus:[box-shadow:none]",
  MENU_FOCUS_RING,
].join(" ");

/**
 * Gatilho de menu num cabeçalho (conta e avatar): sem contorno fora do anel de teclado e sem sombra, inclusive com o
 * menu aberto (só a sombra de hover dos campos aparece aberto). Leva data-own-frame no elemento (fora da moldura de
 * gatilho, controls:): fora do aberto, a borda tem a cor padrão; aberto, a dos campos.
 */
export const HEADER_MENU_TRIGGER =
  "border-border outline-0 data-[state=open]:border-field data-[state=open]:transition-all data-[state=open]:duration-200 data-[state=open]:hover-always:not-focus:shadow-control-hover data-[state=open]:focus:border-field-focus";
