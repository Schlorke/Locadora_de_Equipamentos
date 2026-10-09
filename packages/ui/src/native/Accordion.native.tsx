import { NativeContent } from "./native-content.native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import type {
  AccordionContentProps,
  AccordionItemProps,
  AccordionProps,
  AccordionTriggerProps,
} from "../contract/accordion";

const AccordionContext = createContext<{
  type: "single" | "multiple";
  open: Set<string>;
  toggle: (value: string) => void;
  collapsible: boolean;
} | null>(null);

const AccordionItemContext = createContext<{value:string;disabled:boolean} | null>(null);

function toSet(value: string | string[] | undefined): Set<string> {
  if (value === undefined) return new Set();
  return new Set(Array.isArray(value) ? value : [value]);
}

export function Accordion({
  type = "single",
  value: controlled,
  defaultValue,
  onValueChange,
  collapsible = false,
  children,
}: AccordionProps) {
  const [uncontrolled, setUncontrolled] = useState(() => toSet(defaultValue));
  const open = controlled !== undefined ? toSet(controlled) : uncontrolled;

  const emit = useCallback(
    (next: Set<string>) => {
      if (controlled === undefined) setUncontrolled(next);
      const payload =
        type === "multiple" ? Array.from(next) : (Array.from(next)[0] ?? "");
      onValueChange?.(payload);
    },
    [controlled, onValueChange, type],
  );

  const toggle = useCallback(
    (itemValue: string) => {
      const next = new Set(open);
      if (next.has(itemValue)) {
        if (type === "single" && !collapsible) return;
        next.delete(itemValue);
      } else if (type === "single") {
        next.clear();
        next.add(itemValue);
      } else {
        next.add(itemValue);
      }
      emit(next);
    },
    [collapsible, emit, open, type],
  );

  const ctx = useMemo(
    () => ({ type, open, toggle, collapsible }),
    [type, open, toggle, collapsible],
  );

  return (
    <AccordionContext.Provider value={ctx}><NativeContent>{children}</NativeContent></AccordionContext.Provider>
  );
}

export function AccordionItem({ value, children, disabled=false }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={{value,disabled}}>
      <View><NativeContent>{children}</NativeContent></View>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({ children }: AccordionTriggerProps) {
  const accordion = useContext(AccordionContext);
  const item=useContext(AccordionItemContext);
  const itemValue = item?.value ?? null;
  const expanded = itemValue !== null && accordion?.open.has(itemValue) === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded,disabled:item?.disabled }}
      disabled={item?.disabled}
      onPress={() => {
        if (itemValue && !item?.disabled) accordion?.toggle(itemValue);
      }}
    >
      {typeof children === "string" ? <Text><NativeContent>{children}</NativeContent></Text> : children}
      <Text>{expanded ? "▲" : "▼"}</Text>
    </Pressable>
  );
}

export function AccordionContent({ children }: AccordionContentProps) {
  const accordion = useContext(AccordionContext);
  const item=useContext(AccordionItemContext);
  const itemValue = item?.value ?? null;
  if (itemValue === null || accordion?.open.has(itemValue) !== true) return null;
  return <View><NativeContent>{children}</NativeContent></View>;
}
