// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const native=vi.hoisted(()=>({classNames:[] as unknown[],openURL:vi.fn()}));
vi.mock("react-native",()=>{
 type Props={children?:import("react").ReactNode;className?:unknown;accessibilityRole?:string;accessibilityLabel?:string;accessibilityState?:{expanded?:boolean;disabled?:boolean};disabled?:boolean;onPress?:()=>void};
 const track=(props:object)=>{if("className" in props)native.classNames.push((props as Props).className)};
 return {
  View:(props:Props)=>{track(props);return <div>{props.children}</div>},
  Text:(props:Props)=>{track(props);return <span>{props.children}</span>},
  Pressable:(props:Props)=>{track(props);return <button role={props.accessibilityRole} aria-label={props.accessibilityLabel} aria-expanded={props.accessibilityState?.expanded} disabled={props.disabled} onClick={props.onPress}>{props.children}</button>},
  Linking:{openURL:native.openURL},
 };
});
import {NavigationProvider} from "../contract/navigation";
import {NavigationMenu,NavigationMenuContent,NavigationMenuIndicator,NavigationMenuItem,NavigationMenuLink,NavigationMenuList,NavigationMenuTrigger,navigationMenuTriggerStyle} from "./NavigationMenu.native";
afterEach(()=>{cleanup();native.classNames=[];native.openURL.mockClear()});
describe("Native navigation menu",()=>{
 it("expande um item por vez, navega pelo adapter e não usa Tailwind",()=>{
  const navigate=vi.fn(),onValueChange=vi.fn(),orcamento=vi.fn();
  render(<NavigationProvider navigate={navigate}><NavigationMenu onValueChange={onValueChange}><NavigationMenuList>
   <NavigationMenuItem value="equipamentos"><NavigationMenuTrigger>Equipamentos</NavigationMenuTrigger><NavigationMenuContent><NavigationMenuLink href="/equipamentos/andaimes">Andaimes</NavigationMenuLink></NavigationMenuContent></NavigationMenuItem>
   <NavigationMenuItem value="empresa"><NavigationMenuTrigger>Empresa</NavigationMenuTrigger><NavigationMenuContent><NavigationMenuLink href="/sobre">Sobre</NavigationMenuLink></NavigationMenuContent></NavigationMenuItem>
   <NavigationMenuItem value="bloqueado"><NavigationMenuTrigger disabled>Indisponível</NavigationMenuTrigger><NavigationMenuContent><NavigationMenuLink href="/oculto">Oculto</NavigationMenuLink></NavigationMenuContent></NavigationMenuItem>
   <NavigationMenuItem><NavigationMenuLink onClick={event=>{event.preventDefault();orcamento()}}>Orçamento</NavigationMenuLink></NavigationMenuItem>
  </NavigationMenuList><NavigationMenuIndicator/></NavigationMenu></NavigationProvider>);
  const equipamentos=screen.getByRole("button",{name:"Equipamentos"}),empresa=screen.getByRole("button",{name:"Empresa"});
  expect(equipamentos.getAttribute("aria-expanded")).toBe("false");expect(screen.queryByRole("link",{name:"Andaimes"})).toBeNull();expect(screen.queryByText("▴")).toBeNull();
  fireEvent.click(equipamentos);
  expect(equipamentos.getAttribute("aria-expanded")).toBe("true");expect(screen.getByText("▴")).toBeTruthy();
  fireEvent.click(empresa);
  expect(screen.queryByRole("link",{name:"Andaimes"})).toBeNull();expect(screen.getByRole("link",{name:"Sobre"})).toBeTruthy();
  fireEvent.click(screen.getByRole("link",{name:"Sobre"}));expect(navigate).toHaveBeenCalledExactlyOnceWith("/sobre");expect(native.openURL).not.toHaveBeenCalled();
  fireEvent.click(empresa);expect(screen.queryByRole("link",{name:"Sobre"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Indisponível"}));expect(screen.queryByRole("link",{name:"Oculto"})).toBeNull();
  fireEvent.click(screen.getByRole("link",{name:"Orçamento"}));expect(orcamento).toHaveBeenCalledOnce();
  expect(onValueChange.mock.calls).toEqual([["equipamentos"],["empresa"],[""]]);
  expect(navigationMenuTriggerStyle()).toBe("");expect(native.classNames).toEqual([]);
 });
});
