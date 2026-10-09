"use client";

/**
 * Anel de foco por teclado: contorno de 2px na cor do token --focus-ring (laranja da marca, packages/design-tokens),
 * afastado 2px do elemento. Só aparece em :focus-visible, então o clique do mouse num botão ou aba não mostra anel.
 * Nas cores forçadas (alto contraste do Windows) o sistema troca a cor, e o contorno continua sendo o sinal do foco.
 */
export const FOCUS_RING =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * O mesmo anel para itens e gatilhos de menu do Radix e para o X do Dialog e do Sheet. Os menus movem o foco por
 * código (hover do mouse, abrir, devolver o foco ao gatilho) e os diálogos movem o foco inicial para o X ao abrir; o
 * navegador pode tratar esse foco como :focus-visible mesmo quando a pessoa usa o mouse. Por isso esse anel só vale
 * com a modalidade de teclado registrada no <html> (`trackInputModality`) e, fora dela, nenhum contorno em nenhum modo:
 * `outline-hidden` desliga o anel do navegador e, nas cores forçadas, onde ele grava um contorno sólido transparente
 * que o sistema pinta, `forced-colors:outline-0` zera a largura. Em repouso e no clique, nada (como na produção);
 * aberto pelo teclado, o X mostra o anel (no alto contraste, na cor do sistema).
 */
export const MENU_FOCUS_RING =
  "outline-hidden forced-colors:outline-0 in-data-[input-modality=keyboard]:focus-visible:outline-solid in-data-[input-modality=keyboard]:focus-visible:outline-2 in-data-[input-modality=keyboard]:focus-visible:outline-offset-2 in-data-[input-modality=keyboard]:focus-visible:outline-focus-ring";

/**
 * Foco de um controle cujo sinal é um halo de sombra (caixa de seleção, como na produção): nenhum contorno no foco no
 * modo normal, nem no clique. Nas cores forçadas o sistema apaga a sombra, então o foco por teclado (:focus-visible)
 * ganha contorno de 2px na cor do sistema e o clique continua sem nada: focus:outline-hidden grava lá um sólido
 * transparente que o sistema pinta, forced-colors:focus:outline-0 zera a largura e forced-colors:focus-visible:outline-2
 * a devolve só no teclado.
 */
export const HALO_FOCUS_OUTLINE =
  "focus:outline-hidden forced-colors:focus:outline-0 forced-colors:focus-visible:outline-2";

let tracking = false;

/**
 * Registra no <html> a última forma de interação: `data-input-modality="keyboard"` depois de uma tecla (sem Ctrl, Alt
 * ou Meta) e `"pointer"` depois de mouse, toque ou caneta. Instalado uma vez por documento, quando um menu ou um
 * diálogo é carregado.
 */
export function trackInputModality(doc: Document | undefined = typeof document === "undefined" ? undefined : document): void {
  if (!doc || tracking) return;
  tracking = true;
  const root = doc.documentElement;
  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.metaKey || event.altKey || event.ctrlKey) return;
      root.setAttribute("data-input-modality", "keyboard");
    },
    true,
  );
  doc.addEventListener("pointerdown", () => root.setAttribute("data-input-modality", "pointer"), true);
}
