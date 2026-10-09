import { NativeContent } from "./native-content.native";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, View } from "react-native";
import type {
  CollapsibleContentProps,
  CollapsibleProps,
  CollapsibleTriggerProps,
} from "../contract/collapsible";

const CollapsibleContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
} | null>(null);

export function Collapsible({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  children,
}: CollapsibleProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (controlled === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  const ctx = useMemo(
    () => ({ open, setOpen, disabled }),
    [disabled, open],
  );
  return (
    <CollapsibleContext.Provider value={ctx}><NativeContent>{children}</NativeContent></CollapsibleContext.Provider>
  );
}

export function CollapsibleTrigger({
  children,
  disabled,
}: CollapsibleTriggerProps) {
  const ctx = useContext(CollapsibleContext);
  const isDisabled = Boolean(disabled ?? ctx?.disabled);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: ctx?.open === true, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => ctx?.setOpen(!(ctx.open === true))}
    >
      <NativeContent>{children}</NativeContent>
    </Pressable>
  );
}

export function CollapsibleContent({ children }: CollapsibleContentProps) {
  const ctx = useContext(CollapsibleContext);
  if (ctx?.open !== true) return null;
  return <View>{children as ReactNode}</View>;
}
