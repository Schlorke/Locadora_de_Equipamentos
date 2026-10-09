import type { ReactNode } from "react";

/** Recorte compartilhado web/nativo. O web aceita as props do react-resizable-panels. */
export interface ResizablePanelGroupProps {
  direction?: "horizontal" | "vertical";
  children?: ReactNode;
}

export interface ResizablePanelProps {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  children?: ReactNode;
}

export interface ResizableHandleProps {
  withHandle?: boolean;
  children?: ReactNode;
}
