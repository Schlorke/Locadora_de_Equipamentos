import {useEffect,type ReactNode} from "react";
import {Pressable} from "react-native";
import * as Menu from "./DropdownMenu.native";
import {useOverlay,type OverlayPartProps} from "./overlay.native";
import {NativeContent} from "./native-content.native";
export const ContextMenu=Menu.DropdownMenu;
export function ContextMenuTrigger({children,disabled=false}:{children?:ReactNode;disabled?:boolean}){const state=useOverlay();return <Pressable accessibilityRole="button" disabled={disabled} onLongPress={()=>state.setOpen(true)} onAccessibilityAction={()=>state.setOpen(true)} accessibilityActions={[{name:"activate",label:"Abrir menu de contexto"}]}><NativeContent>{children}</NativeContent></Pressable>;}
export function ContextMenuContent({forceMount, ...props}:OverlayPartProps&{forceMount?:boolean}){const {setOpen}=useOverlay();useEffect(()=>{if(forceMount)setOpen(true)},[forceMount]);return <Menu.DropdownMenuContent {...props}/>;}
export const ContextMenuItem=Menu.DropdownMenuItem,ContextMenuLabel=Menu.DropdownMenuLabel,ContextMenuSeparator=Menu.DropdownMenuSeparator,ContextMenuCheckboxItem=Menu.DropdownMenuCheckboxItem,ContextMenuRadioGroup=Menu.DropdownMenuRadioGroup,ContextMenuRadioItem=Menu.DropdownMenuRadioItem,ContextMenuSub=Menu.DropdownMenuSub,ContextMenuSubTrigger=Menu.DropdownMenuSubTrigger,ContextMenuSubContent=Menu.DropdownMenuSubContent,ContextMenuShortcut=Menu.DropdownMenuShortcut,ContextMenuGroup=Menu.DropdownMenuGroup,ContextMenuPortal=Menu.DropdownMenuPortal;
