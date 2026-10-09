"use client";

import * as React from "react";

/**
 * Trava de rolagem dos primitivos Radix modais (Select, DropdownMenu, ContextMenu, Dialog/Sheet, AlertDialog e
 * Popover modal): o react-remove-scroll marca `<body data-scroll-locked>` e injeta regras `!important` para essa marca
 * (overflow hidden, margem do tamanho da barra de rolagem) e o DismissableLayer grava `pointer-events: none` no body.
 * O produto não trava a página enquanto esses conteúdos estão abertos: sem barra branca nem deslocamento lateral
 * (docs/issues/known-issues.md, select de frete do orçamento).
 *
 * Enquanto um conteúdo ligado por `useReleaseScrollLockRef` estiver montado, a marca sai assim que o Radix a grava
 * (as regras injetadas deixam de casar), `pointer-events` volta ao normal e o body recebe `data-scroll-released`, que
 * o CSS global usa para manter o recorte horizontal que a página tinha com a trava. Conteúdo que não trava (popover
 * não modal) não altera nada.
 *
 * O registro acaba quando o ref do conteúdo é solto ou quando o elemento sai da página, o que vier primeiro: o Select
 * do Radix não solta o ref ao fechar (troca o conteúdo por uma cópia num DocumentFragment fora da página).
 */
interface Hold {
  readonly node: HTMLElement;
}

const holds = new Set<Hold>();
let observer: MutationObserver | null = null;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function release(body: HTMLElement) {
  if (body.hasAttribute("data-scroll-locked")) {
    body.removeAttribute("data-scroll-locked");
    body.setAttribute("data-scroll-released", "");
  }
  if (body.style.pointerEvents === "none") body.style.removeProperty("pointer-events");
}

function stop(body: HTMLElement) {
  observer?.disconnect();
  observer = null;
  body.removeAttribute("data-scroll-released");
}

/** Conteúdos que saíram da página deixam de segurar; sem nenhum aberto, o body volta ao normal. */
function sync(body: HTMLElement) {
  for (const hold of holds) if (!hold.node.isConnected) holds.delete(hold);
  if (holds.size === 0) stop(body);
  else release(body);
}

export interface ScrollReleaseHold {
  /** Desregistra (idempotente). */
  readonly release: () => void;
  /** Ainda registrado: o ref não foi solto e o elemento continua na página. */
  readonly isActive: () => boolean;
}

/** Registra um conteúdo aberto (elemento já na página). */
export function holdScrollRelease(node: HTMLElement): ScrollReleaseHold {
  const body = node.ownerDocument.body;
  const hold: Hold = { node };
  holds.add(hold);
  if (!observer) {
    observer = new MutationObserver(() => sync(body));
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
      childList: true,
      subtree: true,
    });
  }
  release(body);
  return {
    release: () => {
      if (!holds.delete(hold)) return;
      if (holds.size === 0) stop(body);
    },
    isActive: () => holds.has(hold),
  };
}

/**
 * Ref de callback para o elemento do conteúdo Radix: registra quando o elemento entra na página (conteúdo aberto) e
 * desregistra quando é solto. O Select do Radix passa o mesmo ref ao conteúdo fechado, montado num DocumentFragment
 * fora da página: esse elemento não conta como aberto. Repassa o elemento ao ref do consumidor.
 */
export function useReleaseScrollLockRef<T extends HTMLElement>(forwarded?: React.Ref<T>): React.RefCallback<T> {
  const holdRef = React.useRef<ScrollReleaseHold | null>(null);
  const forwardedRef = React.useRef(forwarded);
  useIsomorphicLayoutEffect(() => {
    forwardedRef.current = forwarded;
  }, [forwarded]);
  return React.useCallback((node: T | null) => {
    const current = holdRef.current;
    if (node !== null && node.isConnected) {
      if (!current?.isActive()) holdRef.current = holdScrollRelease(node);
    } else if (current) {
      current.release();
      holdRef.current = null;
    }
    const target = forwardedRef.current;
    if (typeof target === "function") target(node);
    else if (target) (target as React.MutableRefObject<T | null>).current = node;
  }, []);
}
