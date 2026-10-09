import { Children, cloneElement, createContext, isValidElement, useContext, useRef, useState, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { space, border } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";
import type {ResizableHandleProps,ResizablePanelGroupProps,ResizablePanelProps} from "../contract/resizable";
type PanelSpec={defaultSize:number;minSize:number;maxSize:number};
const GroupContext=createContext<{direction:"horizontal"|"vertical";sizes:number[];extent:number;resize:(index:number,amount:number)=>void}|null>(null);
function useGroup(){const ctx=useContext(GroupContext);if(!ctx)throw new Error("Resizable parts require ResizablePanelGroup");return ctx;}
export function ResizablePanelGroup({direction="horizontal",children}:ResizablePanelGroupProps){
 const panels=Children.toArray(children).filter((child):child is ReactElement<ResizablePanelProps>=>isValidElement(child)&&child.type===ResizablePanel);
 const specs:PanelSpec[]=panels.map(child=>({defaultSize:child.props.defaultSize??100/panels.length,minSize:child.props.minSize??0,maxSize:child.props.maxSize??100}));
 const [sizes,setSizes]=useState(()=>{const total=specs.reduce((sum,p)=>sum+p.defaultSize,0)||100;return specs.map(p=>p.defaultSize/total*100);});
 const [extent,setExtent]=useState(0);
 const resize=(index:number,amount:number)=>setSizes(current=>{if(!current[index+1])return current;const next=[...current],left=specs[index]!,right=specs[index+1]!;const change=Math.min(left.maxSize-current[index]!,current[index+1]!-right.minSize,Math.max(left.minSize-current[index]!,current[index+1]!-right.maxSize,amount));next[index]=current[index]!+change;next[index+1]=current[index+1]!-change;return next;});
 let index=-1;
 return <GroupContext.Provider value={{direction,sizes,extent,resize}}><View onLayout={event=>setExtent(direction==="horizontal"?event.nativeEvent.layout.width:event.nativeEvent.layout.height)} style={{flex:1,flexDirection:direction==="horizontal"?"row":"column"}}>{Children.map(children,child=>{if(!isValidElement(child))return child;if(child.type===ResizablePanel)index++;return cloneElement(child as ReactElement<{index?:number}>,{index});})}</View></GroupContext.Provider>;
}
export function ResizablePanel({children,index=0}:ResizablePanelProps&{index?:number}){const {sizes}=useGroup();return <View style={{flexGrow:sizes[index]??1,flexBasis:0}}>{children}</View>;}
export function ResizableHandle({withHandle,index=0}:ResizableHandleProps&{index?:number}){
 const group=useGroup(),theme=useTheme(),last=useRef<number|null>(null);
 return <Pressable accessibilityRole="adjustable" accessibilityLabel="Redimensionar painéis" accessibilityValue={{min:0,max:100,now:Math.round(group.sizes[index]??0)}} accessibilityActions={[{name:"increment",label:"Aumentar painel anterior"},{name:"decrement",label:"Diminuir painel anterior"}]} onAccessibilityAction={event=>group.resize(index,event.nativeEvent.actionName==="increment"?5:-5)} onStartShouldSetResponder={()=>true} onResponderGrant={event=>{last.current=group.direction==="horizontal"?event.nativeEvent.pageX:event.nativeEvent.pageY;}} onResponderMove={event=>{const position=group.direction==="horizontal"?event.nativeEvent.pageX:event.nativeEvent.pageY;if(last.current!==null&&group.extent>0)group.resize(index,(position-last.current)/group.extent*100);last.current=position;}} onResponderRelease={()=>{last.current=null;}} style={{padding:space.sm,backgroundColor:theme.surface,borderWidth:border.hairline,borderColor:theme.border,justifyContent:"center"}}>{withHandle?<Text style={{color:theme.text}}>{group.direction==="horizontal"?"⋮":"⋯"}</Text>:null}</Pressable>;
}
