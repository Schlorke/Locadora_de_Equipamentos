import { ScrollView } from "react-native";
import type { ReactNode } from "react";
export function ScrollArea({children,maxHeight,horizontal=false}:{children?:ReactNode;maxHeight?:number;horizontal?:boolean;className?:string}){return <ScrollView horizontal={horizontal} showsHorizontalScrollIndicator={horizontal} showsVerticalScrollIndicator={!horizontal} style={{maxHeight}}>{children}</ScrollView>;}
/** Native scroll indicators are owned by ScrollView. */
export function ScrollBar(_props:{orientation?:"vertical"|"horizontal"}){return null;}
