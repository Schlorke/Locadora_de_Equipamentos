// @vitest-environment jsdom
import {act,cleanup,render,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({moves:[] as Array<{toValue:number;duration:number}>,handler:null as null|((event:{nativeEvent:{locationX:number}})=>void)}));
vi.mock("react-native",()=>{
 const View=({children,onResponderMove}:{children?:import("react").ReactNode;onResponderMove?:typeof state.handler})=>{if(onResponderMove)state.handler=onResponderMove;return <div>{children}</div>};
 return {View,Text:({children}:{children?:import("react").ReactNode})=><span>{children}</span>,Image:()=>null,useWindowDimensions:()=>({width:400,height:800}),AccessibilityInfo:{isReduceMotionEnabled:async()=>true,addEventListener:()=>({remove:vi.fn()})},Animated:{View,Value:class{constructor(public value:number){}},timing:(_value:unknown,config:{toValue:number;duration:number})=>({start:()=>state.moves.push(config)})}};
});
vi.mock("react-native-svg",()=>({default:({children}:{children?:import("react").ReactNode})=><div>{children}</div>,Defs:()=>null,RadialGradient:()=>null,Stop:()=>null,Rect:()=>null}));
import {GridMotion} from "./GridMotion.native";
afterEach(()=>{cleanup();state.moves=[];state.handler=null});
describe("Native motion grid",()=>{it("responds to touch in alternating rows and respects reduced motion",async()=>{
 render(<GridMotion items={["Equipamento"]}/>);
 await act(async()=>{await Promise.resolve()});await waitFor(()=>expect(state.handler).not.toBeNull());
 act(()=>state.handler?.({nativeEvent:{locationX:350}}));
 expect(state.moves.map(move=>move.toValue)).toEqual([112.5,-112.5,112.5,-112.5]);expect(state.moves.every(move=>move.duration===0)).toBe(true);
})});
