import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { space, border } from "@gb-locacoes/design-tokens";
import { NativeContent } from "./native-content.native";
import { Link } from "./Link.native";
import { useTheme } from "../theme/ThemeProvider";
const Root=createContext<{value:string;setValue:(value:string)=>void}|null>(null),Item=createContext<string>("");
export function NavigationMenu({children,value,defaultValue="",onValueChange}:{children?:ReactNode;value?:string;defaultValue?:string;onValueChange?:(value:string)=>void}){const [internal,setInternal]=useState(defaultValue);return <Root.Provider value={{value:value??internal,setValue:next=>{setInternal(next);onValueChange?.(next)}}}><View><NativeContent>{children}</NativeContent></View></Root.Provider>;}
export function NavigationMenuList({children}:{children?:ReactNode}){return <View><NativeContent>{children}</NativeContent></View>;}
export function NavigationMenuItem({children,value}:{children?:ReactNode;value?:string}){const id=useId();return <Item.Provider value={value??id}><View><NativeContent>{children}</NativeContent></View></Item.Provider>;}
export function NavigationMenuTrigger({children,disabled=false}:{children?:ReactNode;disabled?:boolean}){const root=useContext(Root),item=useContext(Item);return <Pressable accessibilityRole="button" accessibilityState={{expanded:root?.value===item,disabled}} disabled={disabled} onPress={()=>root?.setValue(root.value===item?"":item)}><NativeContent>{children}</NativeContent></Pressable>;}
export function NavigationMenuContent({children}:{children?:ReactNode}){const root=useContext(Root),item=useContext(Item);return root?.value===item?<View><NativeContent>{children}</NativeContent></View>:null;}
export function NavigationMenuLink({children,href="",onClick,onPress}:{children?:ReactNode;href?:string;onPress?:()=>void;onClick?:(event:{preventDefault:()=>void})=>void}){return onClick||onPress?<Pressable accessibilityRole="link" onPress={()=>{onClick?.({preventDefault:()=>{}});onPress?.();}}><NativeContent>{children}</NativeContent></Pressable>:<Link href={href}>{children}</Link>;}
export function NavigationMenuViewport({children}:{children?:ReactNode}){return children?<View><NativeContent>{children}</NativeContent></View>:null;}
export function NavigationMenuIndicator(){const root=useContext(Root),theme=useTheme();return root?.value?<View style={{borderTopWidth:border.hairline,borderTopColor:theme.border,paddingTop:space.xs}}><Text style={{color:theme.text}}>▴</Text></View>:null;}
export function navigationMenuTriggerStyle(){return "";}
