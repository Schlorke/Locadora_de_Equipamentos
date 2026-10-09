// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const native=vi.hoisted(()=>({classNames:[] as unknown[],nextTag:1}));
vi.mock("react-native",async()=>{
 const React=await import("react");
 type Props={children?:React.ReactNode;className?:unknown;role?:string;accessibilityRole?:string;accessibilityLabel?:string;accessibilityState?:{expanded?:boolean;checked?:boolean|"mixed"};disabled?:boolean;onPress?:()=>void};
 const track=(props:object)=>{if("className" in props)native.classNames.push((props as Props).className)};
 const host=()=>({tag:native.nextTag++,focus:vi.fn(),measureInWindow:(callback:(_x:number,_y:number,_width:number,_height:number)=>void)=>callback(0,0,120,40)});
 const View=React.forwardRef((props:Props,ref)=>{track(props);const target=React.useRef(host());React.useImperativeHandle(ref,()=>target.current);return <div role={props.role??props.accessibilityRole}>{props.children}</div>});
 const Text=React.forwardRef((props:Props,ref)=>{track(props);const target=React.useRef(host());React.useImperativeHandle(ref,()=>target.current);return <span>{props.children}</span>});
 const Pressable=React.forwardRef((props:Props,ref)=>{track(props);const target=React.useRef(host());React.useImperativeHandle(ref,()=>target.current);return <button role={props.accessibilityRole} aria-label={props.accessibilityLabel} aria-expanded={props.accessibilityState?.expanded} disabled={props.disabled} onClick={props.onPress}>{props.children}</button>});
 const Modal=({children,visible}:{children?:React.ReactNode;visible:boolean})=>visible?<div>{children}</div>:null;
 return {View,Text,Pressable,Modal,ScrollView:View,useWindowDimensions:()=>({width:400,height:800}),findNodeHandle:(target:{tag:number})=>target.tag,AccessibilityInfo:{setAccessibilityFocus:vi.fn()}};
});
import {Menubar,MenubarContent,MenubarItem,MenubarMenu,MenubarSeparator,MenubarTrigger} from "./Menubar.native";
afterEach(()=>{cleanup();native.classNames=[]});
describe("Native menubar",()=>{
 it("abre um menu por vez a partir da barra, executa o item e fecha, sem repassar Tailwind",()=>{
  const onValueChange=vi.fn(),desfazer=vi.fn();
  render(<Menubar onValueChange={onValueChange}>
   <MenubarMenu value="arquivo"><MenubarTrigger>Arquivo</MenubarTrigger><MenubarContent className="bg-popover p-1 text-popover-foreground"><MenubarItem>Novo orçamento</MenubarItem><MenubarSeparator/><MenubarItem>Exportar</MenubarItem></MenubarContent></MenubarMenu>
   <MenubarMenu value="editar"><MenubarTrigger>Editar</MenubarTrigger><MenubarContent><MenubarItem onClick={desfazer}>Desfazer</MenubarItem></MenubarContent></MenubarMenu>
  </Menubar>);
  const bar=screen.getByRole("menubar");
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(within(bar).getByRole("button",{name:"Arquivo"}));
  expect(within(screen.getByRole("menu")).getByRole("menuitem",{name:"Novo orçamento"})).toBeTruthy();
  expect(within(bar).getByRole("button",{name:"Arquivo"}).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(within(bar).getByRole("button",{name:"Editar"}));
  expect(screen.getAllByRole("menu")).toHaveLength(1);
  expect(screen.queryByRole("menuitem",{name:"Novo orçamento"})).toBeNull();
  fireEvent.click(screen.getByRole("menuitem",{name:"Desfazer"}));
  expect(desfazer).toHaveBeenCalledOnce();
  expect(screen.queryByRole("menu")).toBeNull();
  expect(onValueChange.mock.calls).toEqual([["arquivo"],["editar"],[""]]);
  expect(native.classNames).toEqual([]);
 });
});
