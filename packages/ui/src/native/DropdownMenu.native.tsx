import {NativeContent} from "./native-content.native";
import {createContext,useContext,type ReactNode} from "react";
import {Pressable,Text,View} from "react-native";
import { typography, border,space} from "@gb-locacoes/design-tokens";
import {useTheme} from "../theme/ThemeProvider";
import {OverlayRoot,OverlayTrigger,OverlayPortal,OverlayPopup,OverlaySection,useOverlay,type OverlayRootProps,type OverlayPartProps,type OverlayActionProps} from "./overlay.native";
export const DropdownMenu=OverlayRoot,DropdownMenuTrigger=OverlayTrigger,DropdownMenuPortal=OverlayPortal,DropdownMenuGroup=OverlaySection;
export function DropdownMenuContent(props:OverlayPartProps){return <OverlayPopup {...props} kind="menu"/>}
export const DropdownMenuSubContent=DropdownMenuContent;
export function DropdownMenuSub(props:OverlayRootProps){return <OverlayRoot {...props} closeParentOnSelection/>}
export function DropdownMenuSubTrigger(props:OverlayActionProps){return <OverlayTrigger {...props}/>}
export interface MenuSelectionEvent {defaultPrevented:boolean;preventDefault:()=>void}
export interface DropdownMenuItemProps extends OverlayPartProps {disabled?:boolean;onSelect?:(_event:MenuSelectionEvent)=>void;onClick?:()=>void;inset?:boolean}
function MenuItem({children,disabled,onSelect,onClick,"aria-label":label,checked,role="menuitem"}:DropdownMenuItemProps&{checked?:boolean|"indeterminate";role?:"menuitem"|"checkbox"|"radio"}){
 const overlay=useOverlay(),theme=useTheme();
 const select=()=>{if(disabled)return;const event:MenuSelectionEvent={defaultPrevented:false,preventDefault(){this.defaultPrevented=true}};onSelect?.(event);if(!event.defaultPrevented){onClick?.();overlay.closeAll()}};
 return <Pressable accessibilityRole={role} accessibilityLabel={label??(typeof children==="string"?children:undefined)} accessibilityState={{disabled:Boolean(disabled),...(checked===undefined?{}:{checked:checked==="indeterminate"?"mixed":checked})}} disabled={disabled} onPress={select} style={{minHeight:space.xxl,padding:space.sm,flexDirection:"row",alignItems:"center",gap:space.sm,opacity:disabled?0.5:1}}>
 {checked!==undefined?<Text style={{color:theme.primary}}>{checked==="indeterminate"?"−":checked?"✓":"○"}</Text>:null}
 <NativeContent>{children}</NativeContent>
 </Pressable>
}
export function DropdownMenuItem(props:DropdownMenuItemProps){return <MenuItem {...props}/>}
export function DropdownMenuCheckboxItem({checked=false,onCheckedChange,onClick,...props}:DropdownMenuItemProps&{checked?:boolean|"indeterminate";onCheckedChange?:(_checked:boolean)=>void}){return <MenuItem {...props} checked={checked} role="checkbox" onClick={()=>{onCheckedChange?.(checked!==true);onClick?.()}}/>}
const Radio=createContext<{value:string|undefined;setValue:(_value:string)=>void}|null>(null);
export function DropdownMenuRadioGroup({children,value,onValueChange}:{children?:ReactNode;value?:string;onValueChange?:(_value:string)=>void}){return <Radio.Provider value={{value,setValue:next=>onValueChange?.(next)}}><View accessibilityRole="radiogroup">{children}</View></Radio.Provider>}
export function DropdownMenuRadioItem({value,onClick,...props}:DropdownMenuItemProps&{value:string}){const radio=useContext(Radio);if(!radio)throw new Error("RadioItem precisa de DropdownMenuRadioGroup.");return <MenuItem {...props} role="radio" checked={radio.value===value} onClick={()=>{radio.setValue(value);onClick?.()}}/>}
export function DropdownMenuLabel({children}:OverlayPartProps){const theme=useTheme();return <Text accessibilityRole="header" style={{color:theme.text,fontWeight: typography.weight.semibold,padding:space.sm}}>{children}</Text>}
export function DropdownMenuSeparator(){const theme=useTheme();return <View style={{height:border.hairline,backgroundColor:theme.border,marginVertical:space.xs}}/>}
export function DropdownMenuShortcut({children}:OverlayPartProps){const theme=useTheme();return <Text style={{color:theme.textMuted}}>{children}</Text>}
