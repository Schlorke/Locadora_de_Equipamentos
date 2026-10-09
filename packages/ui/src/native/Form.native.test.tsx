// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {useForm} from "react-hook-form";
import {afterEach,describe,expect,it,vi} from "vitest";
import {themes} from "@gb-locacoes/design-tokens";
const native=vi.hoisted(()=>({classNames:[] as unknown[]}));
vi.mock("react-native",()=>{
 type Props={children?:import("react").ReactNode;className?:unknown;nativeID?:string;accessibilityRole?:string;style?:{color?:string};onPress?:()=>void};
 const track=(props:object)=>{if("className" in props)native.classNames.push((props as Props).className)};
 return {
  View:(props:Props)=>{track(props);return <div>{props.children}</div>},
  Text:(props:Props)=>{track(props);return <span id={props.nativeID} role={props.accessibilityRole} data-color={props.style?.color}>{props.children}</span>},
  Pressable:(props:Props)=>{track(props);return <button onClick={props.onPress}>{props.children}</button>},
  TextInput:(props:{className?:unknown;id?:string;value?:string;onChangeText?:(_text:string)=>void;"aria-labelledby"?:string;"aria-invalid"?:boolean})=>{track(props);return <input id={props.id} aria-labelledby={props["aria-labelledby"]} aria-invalid={props["aria-invalid"]} value={props.value} onChange={event=>props.onChangeText?.(event.target.value)}/>},
 };
});
import {Pressable,Text,TextInput} from "react-native";
import {Form,FormControl,FormDescription,FormField,FormItem,FormLabel,FormMessage} from "./Form.native";
afterEach(()=>{cleanup();native.classNames=[]});
function ClienteForm({onSubmit}:{onSubmit:(_values:{nome:string})=>void}){
 const form=useForm<{nome:string}>({defaultValues:{nome:""}});
 return <Form {...form}>
  <FormField control={form.control} name="nome" rules={{required:"Informe o nome"}} render={({field})=><FormItem className="space-y-2">
   <FormLabel className="text-destructive">Nome</FormLabel>
   <FormControl><TextInput value={field.value} onChangeText={field.onChange}/></FormControl>
   <FormDescription className="text-sm">Como aparece no contrato</FormDescription>
   <FormMessage className="text-destructive"/>
  </FormItem>}/>
  <Pressable onPress={()=>void form.handleSubmit(onSubmit)()}><Text>Salvar</Text></Pressable>
 </Form>;
}
describe("Native form (RHF)",()=>{
 it("valida pelo React Hook Form, anuncia o erro com tokens do tema e não repassa Tailwind",async()=>{
  const onSubmit=vi.fn();
  render(<ClienteForm onSubmit={onSubmit}/>);
  const input=screen.getByLabelText("Nome"),label=screen.getByText("Nome");
  expect(label.getAttribute("data-color")).toBe(themes.light.text);expect(input.getAttribute("aria-invalid")).toBe("false");
  fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
  const message=await screen.findByRole("alert");
  expect(message.textContent).toBe("Informe o nome");expect(message.getAttribute("data-color")).toBe(themes.light.danger);
  expect(label.getAttribute("data-color")).toBe(themes.light.danger);expect(input.getAttribute("aria-invalid")).toBe("true");expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(input,{target:{value:"Construtora Alfa"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
  await waitFor(()=>expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSubmit.mock.calls[0]?.[0]).toEqual({nome:"Construtora Alfa"});expect(screen.queryByRole("alert")).toBeNull();
  expect(native.classNames).toEqual([]);
 });
});
