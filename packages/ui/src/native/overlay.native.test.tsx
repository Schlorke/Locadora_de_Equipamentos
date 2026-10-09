// @vitest-environment jsdom
import {useState} from "react";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const native=vi.hoisted(()=>({focus:vi.fn(),nextTag:1}));
vi.mock("react-native",async()=>{
 const React=await import("react");
 const host=()=>({tag:native.nextTag++,focus:vi.fn(),measureInWindow:(callback:(x:number,y:number,width:number,height:number)=>void)=>callback(12,24,100,48)});
 const View=React.forwardRef(({children,role,testID}:{children?:React.ReactNode;role?:string;testID?:string},ref)=>{const target=React.useRef(host());React.useImperativeHandle(ref,()=>target.current);return <div role={role} data-testid={testID}>{children}</div>});
 const Text=React.forwardRef(({children,accessibilityRole}:{children?:React.ReactNode;accessibilityRole?:string},ref)=>{const target=React.useRef(host());React.useImperativeHandle(ref,()=>target.current);return <span role={accessibilityRole==="header"?"heading":undefined}>{children}</span>});
 const Pressable=React.forwardRef(({children,onPress,disabled,accessibilityRole,accessibilityLabel,accessibilityState,testID}:{children?:React.ReactNode;onPress?:()=>void;disabled?:boolean;accessibilityRole?:string;accessibilityLabel?:string;accessibilityState?:{checked?:boolean;expanded?:boolean};testID?:string},ref)=>{const target=React.useRef(host());React.useImperativeHandle(ref,()=>target.current);return <button data-tag={target.current.tag} data-testid={testID} role={accessibilityRole} aria-label={accessibilityLabel} aria-checked={accessibilityState?.checked} aria-expanded={accessibilityState?.expanded} disabled={disabled} onClick={onPress}>{children}</button>});
 const Modal=({children,visible,onShow,onRequestClose}:{children?:React.ReactNode;visible:boolean;onShow?:()=>void;onRequestClose:()=>void})=>{React.useEffect(()=>{if(visible)onShow?.()},[visible]);return visible?<div><button aria-label="Hardware back" onClick={onRequestClose}/>{children}</div>:null};
 return {View,Text,Pressable,Modal,ScrollView:View,useWindowDimensions:()=>({width:400,height:800}),findNodeHandle:(target:{tag:number})=>target.tag,AccessibilityInfo:{setAccessibilityFocus:native.focus}};
});
import {Dialog} from "./Dialog.native";
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogTitle,AlertDialogAction} from "./AlertDialog.native";
import {Sheet,SheetTrigger,SheetContent,SheetTitle} from "./Sheet.native";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuCheckboxItem,DropdownMenuRadioGroup,DropdownMenuRadioItem,DropdownMenuSub,DropdownMenuSubTrigger,DropdownMenuSubContent} from "./DropdownMenu.native";
import {Tooltip,TooltipProvider,TooltipTrigger,TooltipContent} from "./Tooltip.native";
import {Popover,PopoverTrigger,PopoverContent,PopoverClose} from "./Popover.native";
import {Button} from "./Button.native";
afterEach(()=>{cleanup();native.focus.mockClear()});
describe("Native overlays",()=>{
 it("opens from a composed trigger, closes on cancel, and restores accessibility focus",()=>{
  render(<Dialog.Root><Dialog.Trigger asChild><Button>Abrir</Button></Dialog.Trigger><Dialog.Popup><Dialog.Title>Título</Dialog.Title><Dialog.Description>Detalhes</Dialog.Description><Dialog.Close>Cancelar</Dialog.Close></Dialog.Popup></Dialog.Root>);
  expect(screen.queryByRole("dialog")).toBeNull();const trigger=screen.getByRole("button",{name:"Abrir"});const tag=Number(trigger.getAttribute("data-tag"));
  fireEvent.click(trigger);expect(screen.getByRole("dialog")).toBeTruthy();expect(screen.getByRole("heading",{name:"Título"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));expect(screen.queryByRole("dialog")).toBeNull();expect(native.focus).toHaveBeenLastCalledWith(tag);
 });
 it("keeps controlled state in the caller and ignores disabled triggers",()=>{
  const change=vi.fn();const {rerender}=render(<Dialog.Root open={false} onOpenChange={change}><Dialog.Trigger>Controlado</Dialog.Trigger><Dialog.Popup>Conteúdo</Dialog.Popup></Dialog.Root>);
  fireEvent.click(screen.getByRole("button",{name:"Controlado"}));expect(change).toHaveBeenCalledWith(true);expect(screen.queryByRole("dialog")).toBeNull();
  rerender(<Dialog.Root open={false} onOpenChange={change}><Dialog.Trigger disabled>Controlado</Dialog.Trigger><Dialog.Popup>Conteúdo</Dialog.Popup></Dialog.Root>);change.mockClear();fireEvent.click(screen.getByRole("button",{name:"Controlado"}));expect(change).not.toHaveBeenCalled();
 });
 it("requires an alert action and invokes confirmation before closing",()=>{
  const confirm=vi.fn();render(<AlertDialog><AlertDialogTrigger>Excluir</AlertDialogTrigger><AlertDialogContent><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogAction onClick={confirm}>Confirmar</AlertDialogAction></AlertDialogContent></AlertDialog>);
  fireEvent.click(screen.getByRole("button",{name:"Excluir"}));expect(screen.getByRole("alertdialog")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Confirmar"}));expect(confirm).toHaveBeenCalledOnce();expect(screen.queryByRole("alertdialog")).toBeNull();
 });
 it("handles Android back and sheet close",()=>{
  render(<Sheet><SheetTrigger>Painel</SheetTrigger><SheetContent side="bottom"><SheetTitle>Filtros</SheetTitle></SheetContent></Sheet>);
  fireEvent.click(screen.getByRole("button",{name:"Painel"}));expect(screen.getByRole("dialog")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Hardware back"}));expect(screen.queryByRole("dialog")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Painel"}));fireEvent.click(screen.getByRole("button",{name:"Fechar painel"}));expect(screen.queryByRole("dialog")).toBeNull();
 });
 it("applies checkbox/radio selection, ignores disabled items, and supports a submenu",()=>{
  function Menu(){const [checked,setChecked]=useState(false),[value,setValue]=useState("a");return <><span>{checked?"Marcado":"Desmarcado"}:{value}</span><DropdownMenu><DropdownMenuTrigger>Menu</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>Favorito</DropdownMenuCheckboxItem><DropdownMenuRadioGroup value={value} onValueChange={setValue}><DropdownMenuRadioItem value="b">Opção B</DropdownMenuRadioItem></DropdownMenuRadioGroup><DropdownMenuItem disabled>Indisponível</DropdownMenuItem><DropdownMenuSub><DropdownMenuSubTrigger>Mais</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={()=>setValue("c")}>Opção C</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub></DropdownMenuContent></DropdownMenu></>}
  render(<Menu/>);const open=()=>fireEvent.click(screen.getByRole("button",{name:"Menu"}));open();fireEvent.click(screen.getByRole("menuitem",{name:"Indisponível"}));expect(screen.getByRole("menu")).toBeTruthy();fireEvent.click(screen.getByRole("checkbox",{name:"Favorito"}));expect(screen.getByText("Marcado:a")).toBeTruthy();expect(screen.queryByRole("menu")).toBeNull();
  open();fireEvent.click(screen.getByRole("radio",{name:"Opção B"}));expect(screen.getByText("Marcado:b")).toBeTruthy();
  open();fireEvent.click(screen.getByRole("button",{name:"Mais"}));expect(screen.getAllByRole("menu")).toHaveLength(2);fireEvent.click(screen.getByRole("menuitem",{name:"Opção C"}));expect(screen.getByText("Marcado:c")).toBeTruthy();expect(screen.queryByRole("menu")).toBeNull();
 });
 it("supports preventDefault without dismissing the menu",()=>{
  const action=vi.fn();render(<DropdownMenu defaultOpen><DropdownMenuContent><DropdownMenuItem onSelect={event=>event.preventDefault()} onClick={action}>Manter aberto</DropdownMenuItem></DropdownMenuContent></DropdownMenu>);fireEvent.click(screen.getByRole("menuitem",{name:"Manter aberto"}));expect(action).not.toHaveBeenCalled();expect(screen.getByRole("menu")).toBeTruthy();
 });
 it("reveals tooltip and popover content on touch",()=>{
  render(<><TooltipProvider><Tooltip><TooltipTrigger>Ajuda</TooltipTrigger><TooltipContent>Informação útil</TooltipContent></Tooltip></TooltipProvider><Popover><PopoverTrigger>Detalhes</PopoverTrigger><PopoverContent><PopoverClose>Concluir</PopoverClose></PopoverContent></Popover></>);
  expect(screen.queryByText("Informação útil")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Ajuda"}));expect(within(screen.getByRole("tooltip")).getByText("Informação útil")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Hardware back"}));fireEvent.click(screen.getByRole("button",{name:"Detalhes"}));fireEvent.click(screen.getByRole("button",{name:"Concluir"}));expect(screen.queryByRole("dialog")).toBeNull();
 });
});
