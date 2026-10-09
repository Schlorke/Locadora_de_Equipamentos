import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
interface PageLinkProps {children?:ReactNode;href?:string;isActive?:boolean;onClick?:(event:{preventDefault:()=>void})=>void;disabled?:boolean;"aria-label"?:string}
export function Pagination({children}:{children?:ReactNode}){return <View>{children}</View>;}
export function PaginationContent({children}:{children?:ReactNode}){return <View>{children}</View>;}
export function PaginationItem({children}:{children?:ReactNode}){return <View>{children}</View>;}
export function PaginationLink({children,onClick,isActive,disabled,"aria-label":label}:PageLinkProps){return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:isActive,disabled}} disabled={disabled} onPress={()=>onClick?.({preventDefault:()=>{}})}><Text>{children}</Text></Pressable>;}
export function PaginationPrevious(props:PageLinkProps){return <PaginationLink {...props} aria-label="Ir para página anterior">Anterior</PaginationLink>;}
export function PaginationNext(props:PageLinkProps){return <PaginationLink {...props} aria-label="Ir para próxima página">Próximo</PaginationLink>;}
export function PaginationEllipsis(){return <Text accessibilityLabel="More pages">…</Text>;}
