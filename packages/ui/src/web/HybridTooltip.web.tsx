"use client";
import type {HybridTooltipProps} from "../contract/hybrid-tooltip";

import { useEffect, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { twMerge } from "tailwind-merge";
import { useReleaseScrollLockRef } from "./release-scroll-lock";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover)");
    setHasHover(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setHasHover(event.matches);
    };

    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return hasHover;
}

// --- ESTILOS COMPARTILHADOS (FONTE DA VERDADE VISUAL) ---
const contentClassName = cn(
  'group',
  'z-[var(--layer-tooltip)] overflow-hidden rounded-md',
  'bg-white text-gray-700', // Background branco com texto escuro
  'px-4 py-2 text-[13px] shadow-lg [&_p]:text-[13px] [&_p]:leading-normal', // Força 13px em <p> (globals.css sobrescreve via p{})
  'max-w-xs', // FORÇA quebra de linha
  'transition-all duration-100 animate-in fade-in-0 zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  'data-[side=bottom]:slide-in-from-top-4',
  'data-[side=left]:slide-in-from-right-4',
  'data-[side=right]:slide-in-from-left-4',
  'data-[side=top]:slide-in-from-bottom-4'
)

// --- INTERFACE COM PROPS FLEXÍVEIS ---
// --- COMPONENTE HÍBRIDO REUTILIZÁVEL ---
const HybridTooltip: React.FC<HybridTooltipProps> = ({
  children,
  content,
  side = 'top',
  align = 'center',
  sideMobile,
  alignMobile,
  sideOffset = 5,
  delayDuration = 500,
  className,
}) => {
  const hasHover = useHasHover()
  // Popover modal (toque): libera a trava de rolagem do Radix enquanto aberto.
  const popoverContentRef = useReleaseScrollLockRef<HTMLDivElement>()

  // --- DESKTOP: RENDERIZA TOOLTIP ---
  if (hasHover) {
    return (
      <TooltipPrimitive.Provider>
        <TooltipPrimitive.Root delayDuration={delayDuration}>
          <TooltipPrimitive.Trigger asChild>
            {children}
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side={side}
              align={align}
              sideOffset={sideOffset}
              className={cn(contentClassName, className)}
            >
              {content}
              <TooltipPrimitive.Arrow className="fill-white" />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    )
  }

  // --- MOBILE: RENDERIZA POPOVER ---
  // Usa modal para evitar que toques fora fechem instantaneamente.
  // Usa <span> em vez de <button> para evitar button-dentro-de-button (hydration error)
  // quando children já é um <button>, ex: IconCustomizationFooter.
  return (
    <PopoverPrimitive.Root modal>
      <PopoverPrimitive.Trigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center justify-center appearance-none border-0 bg-transparent p-1.5 m-0 rounded-full active:bg-gray-100 transition-colors cursor-pointer"
        >
          {children}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={popoverContentRef}
          side={sideMobile ?? 'bottom'}
          align={alignMobile ?? 'center'}
          sideOffset={sideOffset}
          className={cn(contentClassName, className)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {content}
          <PopoverPrimitive.Arrow className="fill-white" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { HybridTooltip }

// --- EXEMPLO DE USO RECOMENDADO ---
/*
// 1. USO BÁSICO (com ícone de informação padrão):
import { HybridTooltip } from "./Dica";
import { Info } from 'lucide-react'

<HybridTooltip content="Texto explicativo aqui">
  <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600" />
</HybridTooltip>

// 2. USO CUSTOMIZADO (posição e delay personalizados):
<HybridTooltip
  content="Tooltip à direita com delay menor"
  side="right"
  align="start"
  delayDuration={300}
>
  <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600" />
</HybridTooltip>

// 3. USO COM TEXTO LONGO (quebra automática até max-w-xs):
<HybridTooltip
  content="Este é um texto mais longo que será automaticamente quebrado em múltiplas linhas graças ao max-w-xs configurado no estilo padrão."
>
  <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600" />
</HybridTooltip>

// 4. USO COM BOTÃO OU QUALQUER ELEMENTO:
<HybridTooltip content="Clique para salvar as alterações">
  <button className="px-4 py-2 bg-orange-600 text-white rounded-md">
    Salvar
  </button>
</HybridTooltip>

// PADRÃO RECOMENDADO PARA ÍCONES DE INFORMAÇÃO:
// - Tamanho: size-4 (16px)
// - Cor padrão: text-gray-700
// - Hover: hover:text-orange-600
// - Cursor: cursor-help
// - Transição: transition-colors
*/
