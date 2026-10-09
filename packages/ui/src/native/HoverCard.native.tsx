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
  HoverCardContentProps,
  HoverCardProps,
  HoverCardTriggerProps,
} from "../contract/hover-card";

const HoverCardContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function HoverCard({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  children,
}: HoverCardProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (controlled === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  const ctx = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <HoverCardContext.Provider value={ctx}><NativeContent>{children}</NativeContent></HoverCardContext.Provider>
  );
}

export function HoverCardTrigger({ children }: HoverCardTriggerProps) {
  const ctx = useContext(HoverCardContext);
  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={() => ctx?.setOpen(true)}
      onPressOut={() => ctx?.setOpen(false)}
    >
      <NativeContent>{children}</NativeContent>
    </Pressable>
  );
}

export function HoverCardContent({ children }: HoverCardContentProps) {
  const ctx = useContext(HoverCardContext);
  if (ctx?.open !== true) return null;
  return <View>{children as ReactNode}</View>;
}
