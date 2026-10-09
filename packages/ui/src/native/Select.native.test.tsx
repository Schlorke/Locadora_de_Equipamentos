// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("react-native",async()=>{
 const React=await import("react");
 return {
  View:({children}:{children?:React.ReactNode})=><div>{children}</div>,
  Text:({children}:{children?:React.ReactNode})=><span>{children}</span>,
  Modal:({children,visible}:{children?:React.ReactNode;visible:boolean})=>visible?<div role="dialog">{children}</div>:null,
  Pressable:({children,onPress,disabled,accessibilityRole,accessibilityLabel,accessibilityState}:{children?:React.ReactNode;onPress?:()=>void;disabled?:boolean;accessibilityRole?:string;accessibilityLabel?:string;accessibilityState?:{selected?:boolean;expanded?:boolean}})=><button role={accessibilityRole} aria-label={accessibilityLabel} aria-checked={accessibilityState?.selected} aria-expanded={accessibilityState?.expanded} disabled={disabled} onClick={onPress}>{children}</button>,
  ScrollView:React.forwardRef(({children}:{children?:React.ReactNode},ref)=>{React.useImperativeHandle(ref,()=>({scrollTo:vi.fn(),scrollToEnd:vi.fn()}));return <div>{children}</div>}),
 };
});
import {CustomSelect,CustomSelectItem} from "./FilterSelect.native";
afterEach(cleanup);
describe("Native selection renderer",()=>{
 it("opens available options, forwards selection and closes the popup",()=>{
  const onValueChange=vi.fn();render(<CustomSelect value="all" onValueChange={onValueChange}><CustomSelectItem value="all">Todos</CustomSelectItem><CustomSelectItem value="active">Ativos</CustomSelectItem></CustomSelect>);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("combobox"));expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio",{name:"Ativos"}));expect(onValueChange).toHaveBeenCalledExactlyOnceWith("active");expect(screen.queryByRole("dialog")).toBeNull();
 });
 it("does not open disabled selectors",()=>{
  render(<CustomSelect disabled value="all"><CustomSelectItem value="all">Todos</CustomSelectItem></CustomSelect>);
  fireEvent.click(screen.getByRole("combobox"));expect(screen.queryByRole("dialog")).toBeNull();
 });
});
