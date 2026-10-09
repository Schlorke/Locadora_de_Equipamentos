"use client";

import { clsx, type ClassValue } from "clsx";
import * as React from "react";
import { twMerge } from "tailwind-merge";
import { FOCUS_RING } from "./focus-ring";
import type {
  HoverActionMenuPosition,
  HoverActionMenuProps as HoverActionMenuContractProps,
} from "../contract/hover-action-menu";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface HoverActionMenuProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onMouseEnter" | "onMouseLeave" | "children" | "onClick"
    >,
    HoverActionMenuContractProps {
  position?: HoverActionMenuPosition;
  onMouseEnter?: (_e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (_e: React.MouseEvent<HTMLDivElement>) => void;
}

const HoverActionMenu = React.forwardRef<HTMLButtonElement, HoverActionMenuProps>(
  (
    {
      children,
      position = "top-center",
      offset,
      groupName,
      wrapperClassName,
      buttonClassName,
      className,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const groupClass = groupName ? `group-hover/${groupName}:` : "group-hover:";
    const positionClasses = {
      "top-center": "left-1/2 -translate-x-1/2",
      "top-left": "left-0",
      "top-right": "right-0",
      "bottom-center": "left-1/2 -translate-x-1/2",
      "bottom-left": "left-0",
      "bottom-right": "right-0",
    };

    const defaultOffset = position.startsWith("top")
      ? "bottom-full mb-2"
      : "top-full mt-2";

    const hasCustomOffset =
      offset &&
      (offset.includes("top-[") ||
        offset.includes("bottom-[") ||
        offset.includes("top-") ||
        offset.includes("bottom-"));
    const offsetValue = offset ?? defaultOffset;
    const verticalPosition = hasCustomOffset
      ? ""
      : position.startsWith("top")
        ? "bottom-full"
        : "top-full";

    // `relative` no wrapper: menu no fluxo (sem posicionamento absoluto em volta do alvo).
    const isRelative = /(^|\s)relative(\s|$)/.test(wrapperClassName ?? "");
    const wrapperClasses = isRelative
      ? cn("flex z-10", wrapperClassName)
      : cn(
          "absolute flex justify-center z-10",
          positionClasses[position],
          verticalPosition,
          offsetValue,
          wrapperClassName,
        );

    return (
      <div
        className={wrapperClasses}
        style={
          wrapperClassName?.includes("pointer-events-auto")
            ? { pointerEvents: "auto" }
            : { pointerEvents: "none" }
        }
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <button
          ref={ref}
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full shadow-lg transition-all ease-in-out hover:text-orange-600 hover:shadow-xl",
            FOCUS_RING,
            buttonClassName?.includes("opacity-") ||
              buttonClassName?.includes("translate-")
              ? ""
              : "opacity-0 translate-y-1",
            groupName &&
              !buttonClassName?.includes("opacity-") &&
              !buttonClassName?.includes("translate-")
              ? `${groupClass}opacity-100 ${groupClass}translate-y-0`
              : !buttonClassName?.includes("opacity-") &&
                  !buttonClassName?.includes("translate-")
                ? "group-hover:opacity-100 group-hover:translate-y-0"
                : "",
            buttonClassName,
            className,
          )}
          style={{
            pointerEvents: "auto",
          }}
          {...props}
        >
          {children}
        </button>
      </div>
    );
  },
);

HoverActionMenu.displayName = "HoverActionMenu";

export { HoverActionMenu };
