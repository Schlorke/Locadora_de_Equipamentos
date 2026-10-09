import { NativeContent } from "./native-content.native";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Modal, Pressable, Text, View } from "react-native";
import type {
  DrawerCloseProps,
  DrawerContentProps,
  DrawerDescriptionProps,
  DrawerFooterProps,
  DrawerHeaderProps,
  DrawerProps,
  DrawerTitleProps,
  DrawerTriggerProps,
} from "../contract/drawer";

const DrawerContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function Drawer({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  children,
}: DrawerProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (controlled === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  const ctx = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <DrawerContext.Provider value={ctx}><NativeContent>{children}</NativeContent></DrawerContext.Provider>
  );
}

export function DrawerTrigger({ children }: DrawerTriggerProps) {
  const ctx = useContext(DrawerContext);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => ctx?.setOpen(true)}
    >
      <NativeContent>{children}</NativeContent>
    </Pressable>
  );
}

export function DrawerClose({ children }: DrawerCloseProps) {
  const ctx = useContext(DrawerContext);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => ctx?.setOpen(false)}
    >
      <NativeContent>{children}</NativeContent>
    </Pressable>
  );
}

export function DrawerPortal({ children }: { children?: ReactNode }) {
  return <><NativeContent>{children}</NativeContent></>;
}

export function DrawerOverlay() {
  return null;
}

export function DrawerContent({ children }: DrawerContentProps) {
  const ctx = useContext(DrawerContext);
  return (
    <Modal
      visible={ctx?.open === true}
      transparent
      animationType="slide"
      onRequestClose={() => ctx?.setOpen(false)}
    >
      <View><NativeContent>{children}</NativeContent></View>
    </Modal>
  );
}

export function DrawerHeader({ children }: DrawerHeaderProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function DrawerFooter({ children }: DrawerFooterProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function DrawerTitle({ children }: DrawerTitleProps) {
  return (
    <Text accessibilityRole="header">
      {typeof children === "string" ? children : children}
    </Text>
  );
}

export function DrawerDescription({ children }: DrawerDescriptionProps) {
  return (
    <Text>{typeof children === "string" ? children : children}</Text>
  );
}
