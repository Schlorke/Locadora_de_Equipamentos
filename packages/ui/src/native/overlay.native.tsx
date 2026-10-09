import {Children,cloneElement,createContext,isValidElement,useCallback,useContext,useEffect,useId,useRef,useState,type ComponentProps,type ComponentRef,type ReactElement,type ReactNode} from "react";
import {AccessibilityInfo,findNodeHandle,Modal,Pressable,ScrollView,Text,View,useWindowDimensions} from "react-native";
import {border,radius,space,typography} from "@gb-locacoes/design-tokens";
import {useTheme} from "../theme/ThemeProvider";
type Host = ComponentRef<typeof View>;
// O tipo de estilo vem das props reais de View: o `ViewStyle` exportado por "react-native" e sobrescrito
// pela augmentation web do Expo (expo/types/react-native-web.d.ts) no programa do app mobile.
type OverlayStyle = ComponentProps<typeof View>["style"];
type OverlayLayout = Exclude<OverlayStyle, null|undefined|void|false|""|ReadonlyArray<unknown>>;
export interface OverlayRootProps {children?:ReactNode;open?:boolean;defaultOpen?:boolean;onOpenChange?:(_open:boolean)=>void;modal?:boolean;dismissOnBackdrop?:boolean;closeParentOnSelection?:boolean}
export interface OverlayPartProps {children?:ReactNode;className?:string;style?:OverlayStyle;testID?:string;"aria-label"?:string}
export interface OverlayActionProps extends OverlayPartProps {disabled?:boolean;asChild?:boolean;render?:ReactElement;onClick?:()=>void;longPressDelay?:number}
type Anchor={x:number;y:number;width:number;height:number};
type OverlayState={open:boolean;setOpen:(_open:boolean)=>void;closeAll:()=>void;trigger:React.RefObject<Host|null>;title:React.RefObject<ComponentRef<typeof Text>|null>;content:React.RefObject<Host|null>;titleId:string;anchor:Anchor|null;setAnchor:(_anchor:Anchor)=>void;dismissOnBackdrop:boolean;focusTrigger:()=>void};
const Context=createContext<OverlayState|null>(null),PortalContext=createContext(false);
function focus(target:Host|null){if(!target)return;target.focus?.();const handle=findNodeHandle(target);if(typeof handle==="number")AccessibilityInfo.setAccessibilityFocus(handle)}
export function useOverlay(){const state=useContext(Context);if(!state)throw new Error("O componente precisa estar dentro de um Root de overlay.");return state}
export function OverlayRoot({children,open:controlled,defaultOpen=false,onOpenChange,dismissOnBackdrop=true,closeParentOnSelection=false}:OverlayRootProps){
 const parent=useContext(Context),[local,setLocal]=useState(defaultOpen),open=controlled??local,trigger=useRef<Host|null>(null),title=useRef<ComponentRef<typeof Text>|null>(null),content=useRef<Host|null>(null),titleId=useId(),[anchor,setAnchor]=useState<Anchor|null>(null),previous=useRef(open);
 const setOpen=useCallback((next:boolean)=>{if(controlled===undefined)setLocal(next);onOpenChange?.(next)},[controlled,onOpenChange]);
 const focusTrigger=useCallback(()=>focus(trigger.current),[]);
 useEffect(()=>{if(previous.current&&!open)focusTrigger();previous.current=open},[open,focusTrigger]);
 return <Context.Provider value={{open,setOpen,closeAll:()=>{setOpen(false);if(closeParentOnSelection)parent?.closeAll()},trigger,title,content,titleId,anchor,setAnchor,dismissOnBackdrop,focusTrigger}}><PortalContext.Provider value={false}>{children}</PortalContext.Provider></Context.Provider>;
}
function childrenWithText(children:ReactNode,color:string){return Children.map(children,child=>typeof child==="string"||typeof child==="number"?<Text style={{color,fontSize:typography.size.md}}>{child}</Text>:child)}
export function OverlayTrigger({children,asChild,render,disabled,onClick,longPressDelay,"aria-label":label,testID}:OverlayActionProps){
 const state=useOverlay(),theme=useTheme();
 const activate=()=>{if(disabled)return;onClick?.();state.trigger.current?.measureInWindow((x,y,width,height)=>state.setAnchor({x,y,width,height}));state.setOpen(!state.open)};
 const child=render??(asChild&&isValidElement(children)?children:null);
 if(child){const element=child as ReactElement<{onClick?:()=>void;onPress?:()=>void;disabled?:boolean;ref?:React.Ref<Host>}>;const invoke=()=>{if(disabled||element.props.disabled)return;(element.props.onClick??element.props.onPress)?.();activate()};return cloneElement(element,{onClick:invoke,onPress:invoke,disabled:disabled||element.props.disabled,ref:state.trigger})}
 return <Pressable ref={state.trigger} testID={testID} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:Boolean(disabled),expanded:state.open}} onPress={activate} delayLongPress={longPressDelay} onLongPress={longPressDelay===undefined?undefined:()=>state.setOpen(true)} style={{minHeight:space.xxl,padding:space.sm,justifyContent:"center"}}>{childrenWithText(children,theme.text)}</Pressable>;
}
export function OverlayPortal({children}:OverlayPartProps){
 const state=useOverlay();
 return <Modal visible={state.open} transparent animationType="fade" onRequestClose={()=>state.setOpen(false)} onDismiss={state.focusTrigger} onShow={()=>focus(state.title.current??state.content.current)}><PortalContext.Provider value={true}><View style={{flex:1}} accessibilityViewIsModal importantForAccessibility="yes" onAccessibilityEscape={()=>state.setOpen(false)}>{state.open?children:null}</View></PortalContext.Provider></Modal>;
}
export function OverlayBackdrop({style,testID}:OverlayPartProps){const state=useOverlay(),theme=useTheme();return <Pressable testID={testID} accessible={false} onPress={()=>{if(state.dismissOnBackdrop)state.setOpen(false)}} style={[{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:theme.text,opacity:0.45},style]}/>}
export interface OverlayPopupProps extends OverlayPartProps {kind?:"dialog"|"alertdialog"|"menu"|"tooltip";side?:"top"|"bottom"|"left"|"right";variant?:"default"|"compact"|"unstyled";anchored?:boolean;placement?:"top"|"bottom"|"left"|"right";align?:"start"|"center"|"end";sideOffset?:number}
export function OverlayPopup({children,kind="dialog",side,style,testID,anchored:anchorRequested,placement="bottom",align="start",sideOffset=space.xs,"aria-label":label}:OverlayPopupProps){
 const inside=useContext(PortalContext),state=useOverlay(),theme=useTheme(),{width,height}=useWindowDimensions();
 const [measuredHeight,setMeasuredHeight]=useState(space.xxl*2);
 if(!inside)return <OverlayPortal><OverlayBackdrop/><OverlayPopup kind={kind} side={side} anchored={anchorRequested} placement={placement} align={align} sideOffset={sideOffset} style={style} testID={testID} aria-label={label}>{children}</OverlayPopup></OverlayPortal>;
 const anchored=anchorRequested||kind==="menu"||kind==="tooltip";
 const popupWidth=Math.min(width-space.xl,space.xxl*6),anchor=state.anchor??{x:space.md,y:space.xxl,width:0,height:0};
 let left=anchor.x+(align==="center"?(anchor.width-popupWidth)/2:align==="end"?anchor.width-popupWidth:0);
 let top=placement==="top"?anchor.y-measuredHeight-sideOffset:anchor.y+anchor.height+sideOffset;
 if(placement==="left"||placement==="right"){left=placement==="left"?anchor.x-popupWidth-sideOffset:anchor.x+anchor.width+sideOffset;top=anchor.y+(anchor.height-measuredHeight)/2}
 left=Math.max(space.md,Math.min(left,width-popupWidth-space.md));top=Math.max(space.md,Math.min(top,height-measuredHeight-space.md));
 const layout:OverlayLayout=side?{position:"absolute",...(side==="left"||side==="right"?{top:0,bottom:0,width:width*0.85,[side]:0}:{left:0,right:0,maxHeight:height*0.85,[side]:0})}:anchored?{position:"absolute",top,left,width:popupWidth,maxHeight:height*0.8}:{alignSelf:"center",width:Math.min(width-space.xl,space.xxl*12),maxHeight:height-space.xxl*2};
 const surface=<View ref={state.content} accessible={kind==="tooltip"} onLayout={event=>{const next=event.nativeEvent.layout.height;setMeasuredHeight(previous=>previous===next?previous:next)}} testID={testID} role={kind} accessibilityLabel={label} accessibilityLabelledBy={state.titleId} accessibilityViewIsModal style={[layout,{backgroundColor:theme.surface,borderWidth:border.hairline,borderColor:theme.border,borderRadius:radius.lg,padding:space.lg,gap:space.md},style]}>{childrenWithText(children,theme.text)}</View>;
 return side||anchored?surface:<View style={{flex:1,justifyContent:"center"}} pointerEvents="box-none">{surface}</View>;
}
export function OverlayClose({children,onClick,disabled,asChild,render,"aria-label":label}:OverlayActionProps){
 const state=useOverlay(),theme=useTheme();const close=()=>{if(!disabled){onClick?.();state.setOpen(false)}};
 const child=render??(asChild&&isValidElement(children)?children:null);
 if(child){const element=child as ReactElement<{onClick?:()=>void;onPress?:()=>void;disabled?:boolean}>;const invoke=()=>{if(disabled||element.props.disabled)return;(element.props.onClick??element.props.onPress)?.();close()};return cloneElement(element,{onClick:invoke,onPress:invoke,disabled:disabled||element.props.disabled})}
 return <Pressable accessibilityRole="button" accessibilityLabel={label??(typeof children==="string"?children:"Fechar")} accessibilityState={{disabled:Boolean(disabled)}} disabled={disabled} onPress={close} style={{minHeight:space.xxl,padding:space.sm,justifyContent:"center"}}>{childrenWithText(children??"Fechar",theme.text)}</Pressable>;
}
export function OverlayTitle({children}:OverlayPartProps){const state=useOverlay(),theme=useTheme();return <Text ref={state.title} nativeID={state.titleId} accessibilityRole="header" style={{color:theme.text,fontSize:typography.size.lg,fontWeight: typography.weight.semibold}}>{children}</Text>}
export function OverlayDescription({children}:OverlayPartProps){const theme=useTheme();return <Text style={{color:theme.textMuted,fontSize:typography.size.md,lineHeight:typography.lineHeight.md}}>{children}</Text>}
export function OverlaySection({children,style}:OverlayPartProps){const theme=useTheme();return <View style={[{gap:space.sm},style]}>{childrenWithText(children,theme.text)}</View>}
export function OverlayBody({children,style}:OverlayPartProps){const theme=useTheme();return <ScrollView keyboardShouldPersistTaps="handled" style={style} contentContainerStyle={{gap:space.md}}>{childrenWithText(children,theme.text)}</ScrollView>}
