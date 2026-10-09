// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const native=vi.hoisted(()=>({classNames:[] as unknown[]}));
vi.mock("react-native",()=>{
 type Props={children?:import("react").ReactNode;className?:unknown;accessibilityRole?:string;accessibilityLabel?:string;accessibilityState?:{selected?:boolean;disabled?:boolean};disabled?:boolean;onPress?:()=>void};
 const track=(props:object)=>{if("className" in props)native.classNames.push((props as Props).className)};
 return {
  View:(props:Props)=>{track(props);return <div>{props.children}</div>},
  Text:(props:Props)=>{track(props);return <span aria-label={props.accessibilityLabel}>{props.children}</span>},
  Pressable:(props:Props)=>{track(props);return <button role={props.accessibilityRole} aria-label={props.accessibilityLabel} aria-pressed={props.accessibilityState?.selected} disabled={props.disabled} onClick={props.onPress}>{props.children}</button>},
 };
});
import {Pagination,PaginationContent,PaginationEllipsis,PaginationItem,PaginationLink,PaginationNext,PaginationPrevious} from "./Pagination.native";
afterEach(()=>{cleanup();native.classNames=[]});
describe("Native pagination",()=>{
 it("mantém Anterior, Próximo e o rótulo inglês More pages sem Tailwind",()=>{
  const previous=vi.fn(),next=vi.fn(),page=vi.fn();
  render(<Pagination><PaginationContent>
   <PaginationItem><PaginationPrevious disabled onClick={previous}/></PaginationItem>
   <PaginationItem><PaginationLink isActive onClick={page}>1</PaginationLink></PaginationItem>
   <PaginationItem><PaginationEllipsis/></PaginationItem>
   <PaginationItem><PaginationNext onClick={next}/></PaginationItem>
  </PaginationContent></Pagination>);
  const anterior=screen.getByRole("button",{name:"Ir para página anterior"}),proximo=screen.getByRole("button",{name:"Ir para próxima página"});
  expect(anterior.textContent).toBe("Anterior");expect(proximo.textContent).toBe("Próximo");
  fireEvent.click(anterior);expect(previous).not.toHaveBeenCalled();
  fireEvent.click(proximo);expect(next).toHaveBeenCalledOnce();expect(next.mock.calls[0]?.[0]).toHaveProperty("preventDefault");
  const active=screen.getByRole("button",{name:"1"});expect(active.getAttribute("aria-pressed")).toBe("true");fireEvent.click(active);expect(page).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("More pages").textContent).toBe("…");
  expect(native.classNames).toEqual([]);
 });
});
