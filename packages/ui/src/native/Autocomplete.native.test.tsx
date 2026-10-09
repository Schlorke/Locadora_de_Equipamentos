// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {AutocompleteOption} from "../contract/autocomplete";
const native=vi.hoisted(()=>({classNames:[] as unknown[]}));
vi.mock("react-native",()=>{
 type Props={children?:import("react").ReactNode;className?:unknown;accessibilityRole?:string;accessibilityLabel?:string};
 const track=(props:object)=>{if("className" in props)native.classNames.push((props as Props).className)};
 return {
  View:(props:Props)=>{track(props);return <div>{props.children}</div>},
  Text:(props:Props)=>{track(props);return <span>{props.children}</span>},
  Pressable:(props:Props&{onPress?:()=>void})=>{track(props);return <button role={props.accessibilityRole} onClick={props.onPress}>{props.children}</button>},
  ActivityIndicator:(props:Props)=>{track(props);return <span role="progressbar" aria-label={props.accessibilityLabel}/>},
  TextInput:(props:Props&{value?:string;placeholder?:string;editable?:boolean;onChangeText?:(_text:string)=>void;onSubmitEditing?:()=>void})=>{track(props);return <input role={props.accessibilityRole==="search"?"searchbox":undefined} value={props.value} placeholder={props.placeholder} disabled={props.editable===false} onChange={event=>props.onChangeText?.(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")props.onSubmitEditing?.()}}/>},
 };
});
import {Autocomplete} from "./Autocomplete.native";
const betoneira:AutocompleteOption={id:"eq-1",label:"Betoneira 400L",description:"Motor elétrico monofásico",group:"Concretagem",detail:"R$ 80,00/dia"};
async function advance(ms:number){await act(async()=>{await vi.advanceTimersByTimeAsync(ms)})}
const type=(value:string)=>fireEvent.change(screen.getByRole("searchbox"),{target:{value}});
beforeEach(()=>{vi.useFakeTimers()});
afterEach(()=>{cleanup();vi.useRealTimers();native.classNames=[]});
describe("Native autocomplete",()=>{
 it("busca depois de 300ms a partir de 2 letras, com o mesmo placeholder padrão do web",async()=>{
  const loadOptions=vi.fn().mockResolvedValue([betoneira]);
  render(<Autocomplete loadOptions={loadOptions} className="z-[99999] bg-white"/>);
  expect((screen.getByRole("searchbox") as HTMLInputElement).placeholder).toBe("Buscar...");
  type("b");await advance(300);expect(loadOptions).not.toHaveBeenCalled();
  type("be");await advance(299);expect(loadOptions).not.toHaveBeenCalled();
  type("bet");await advance(299);expect(loadOptions).not.toHaveBeenCalled();
  await advance(1);expect(loadOptions).toHaveBeenCalledExactlyOnceWith("bet");
  await advance(0);expect(screen.getByRole("button",{name:/Betoneira 400L/})).toBeTruthy();
  expect(native.classNames).toEqual([]);
 });
 it("seleciona uma sugestão, para de buscar e envia texto livre",async()=>{
  const loadOptions=vi.fn().mockResolvedValue([betoneira]),onSelect=vi.fn(),onSearch=vi.fn();
  render(<Autocomplete loadOptions={loadOptions} onSelect={onSelect} onSearch={onSearch}/>);
  type("be");await advance(300);await advance(0);
  fireEvent.click(screen.getByRole("button",{name:/Betoneira 400L/}));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(betoneira);
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Betoneira 400L");
  expect(screen.queryByRole("button",{name:/Betoneira 400L/})).toBeNull();
  await advance(300);expect(loadOptions).toHaveBeenCalledOnce();
  type("andaime");fireEvent.keyDown(screen.getByRole("searchbox"),{key:"Enter"});expect(onSearch).toHaveBeenCalledExactlyOnceWith("andaime");
 });
 it("não consulta o adapter quando desabilitado",async()=>{
  const loadOptions=vi.fn().mockResolvedValue([betoneira]);
  render(<Autocomplete loadOptions={loadOptions} disabled/>);
  expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(true);
  type("betoneira");await advance(300);expect(loadOptions).not.toHaveBeenCalled();
 });
});
