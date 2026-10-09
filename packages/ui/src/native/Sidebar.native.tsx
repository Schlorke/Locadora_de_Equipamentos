import { Link } from "./Link.native";
import { NativeContent } from "./native-content.native";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type {
  SidebarContentProps,
  SidebarContextValue,
  SidebarFooterProps,
  SidebarGroupActionProps,
  SidebarGroupContentProps,
  SidebarGroupLabelProps,
  SidebarGroupProps,
  SidebarHeaderProps,
  SidebarInputProps,
  SidebarInsetProps,
  SidebarItemProps,
  SidebarMenuActionProps,
  SidebarMenuBadgeProps,
  SidebarMenuButtonProps,
  SidebarMenuItemProps,
  SidebarMenuProps,
  SidebarMenuSkeletonProps,
  SidebarMenuSubButtonProps,
  SidebarMenuSubItemProps,
  SidebarMenuSubProps,
  SidebarProps,
  SidebarProviderProps,
  SidebarRailProps,
  SidebarTriggerProps,
} from "../contract/sidebar";

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
}: SidebarProviderProps) {
  const [openInternal, setOpenInternal] = useState(defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (value: boolean) => {
    onOpenChange?.(value);
    if (openProp === undefined) setOpenInternal(value);
  };
  const value = useMemo<SidebarContextValue>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile: false,
      toggleSidebar: () => setOpen(!open),
    }),
    [open, openMobile],
  );
  return (
    <SidebarContext.Provider value={value}><NativeContent>{children}</NativeContent></SidebarContext.Provider>
  );
}

export function Sidebar({ children, collapsible }: SidebarProps) {
  const {open}=useSidebar();
  if(!open && collapsible==="offcanvas")return null;
  return <View accessibilityRole="none" accessibilityState={{expanded:open}}><NativeContent>{children}</NativeContent></View>;
}

export function SidebarTrigger({ onClick }: SidebarTriggerProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle Sidebar"
      onPress={() => {
        onClick?.();
        toggleSidebar();
      }}
    >
      <Text>☰</Text>
    </Pressable>
  );
}

export function SidebarRail(_props: SidebarRailProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Toggle Sidebar" onPress={toggleSidebar} />
  );
}

export function SidebarInset({ children }: SidebarInsetProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarInput(props: SidebarInputProps) {
  return <TextInput {...props}/>;
}

export function SidebarHeader({ children }: SidebarHeaderProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarFooter({ children }: SidebarFooterProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarContent({ children }: SidebarContentProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarGroup({ children }: SidebarGroupProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarGroupLabel({ children }: SidebarGroupLabelProps) {
  return <Text><NativeContent>{children}</NativeContent></Text>;
}

export function SidebarGroupAction({ children, onClick, disabled }: SidebarGroupActionProps) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onClick}><NativeContent>{children}</NativeContent></Pressable>;
}

export function SidebarGroupContent({ children }: SidebarGroupContentProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarMenu({ children }: SidebarMenuProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarMenuItem({ children }: SidebarMenuItemProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarMenuButton({ children, onClick, disabled }: SidebarMenuButtonProps) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onClick}><NativeContent>{children}</NativeContent></Pressable>;
}

export function SidebarMenuAction({ children, onClick, disabled }: SidebarMenuActionProps) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onClick}><NativeContent>{children}</NativeContent></Pressable>;
}

export function SidebarMenuBadge({ children }: SidebarMenuBadgeProps) {
  return <Text><NativeContent>{children}</NativeContent></Text>;
}

export function SidebarMenuSkeleton(_props: SidebarMenuSkeletonProps) {
  return <View />;
}

export function SidebarMenuSub({ children }: SidebarMenuSubProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarMenuSubItem({ children }: SidebarMenuSubItemProps) {
  return <View><NativeContent>{children}</NativeContent></View>;
}

export function SidebarMenuSubButton({ children, onClick, disabled }: SidebarMenuSubButtonProps) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onClick}><NativeContent>{children}</NativeContent></Pressable>;
}

export function SidebarItem({ href, icon: Icon, children }: SidebarItemProps) {
  return (
    <Link href={href}>
      <Icon/>
      <Text>{children as ReactNode}</Text>
    </Link>
  );
}
