// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {ApiClientProvider,type HttpClient} from "../../../shared/api";
import type {ReactNode} from "react";
import {useEquipmentCatalog} from "./use-equipment-catalog";
afterEach(cleanup);
const equipment=(id:string,name:string)=>({id,name,description:"Equipamento",pricePerDay:100,images:[],category:{id:"category",name:"Obra"},isAvailable:true});
describe("Shared tenant catalog",()=>{
 it("does not query or select a default company when tenantSlug is missing",async()=>{
  const request=vi.fn(),client:HttpClient={request};
  const {result}=renderHook(()=>useEquipmentCatalog({categoria:null}),{wrapper:({children}:{children:ReactNode})=><ApiClientProvider client={client}>{children}</ApiClientProvider>});
  await waitFor(()=>expect(result.current.error).toBe("Selecione uma locadora para consultar o catálogo."));
  expect(request).not.toHaveBeenCalled();
 });
 it("passes explicit scope, paginates and resets the page when searching",async()=>{
  const list=Array.from({length:12},(_,i)=>equipment("id-"+i,"Equipamento "+i));
  const request=vi.fn().mockImplementation(async(path:string)=>path.startsWith("/api/equipments")?list:[]);
  const client:HttpClient={request};
  const {result}=renderHook(()=>useEquipmentCatalog({categoria:null,tenantSlug:"locadora-a"}),{wrapper:({children}:{children:ReactNode})=><ApiClientProvider client={client}>{children}</ApiClientProvider>});
  await waitFor(()=>expect(result.current.isLoading).toBe(false));
  expect(request.mock.calls.map(call=>call[0])).toEqual(["/api/equipments?tenantSlug=locadora-a","/api/categories?tenantSlug=locadora-a"]);
  expect(result.current.currentEquipments).toHaveLength(9);
  act(()=>result.current.changePage(2));expect(result.current.currentEquipments).toHaveLength(3);
  act(()=>result.current.setSearchTerm("Equipamento 11"));expect(result.current.currentPage).toBe(1);expect(result.current.currentEquipments.map(item=>item.id)).toEqual(["id-11"]);
 });
 it("ignores late results from the previous company",async()=>{
  let complete!:(value:unknown)=>void;
  const request=vi.fn().mockImplementation((path:string)=>path.includes("locadora-a")?new Promise(resolve=>{if(path.startsWith("/api/equipments"))complete=resolve;else resolve([])}):Promise.resolve(path.startsWith("/api/equipments")?[equipment("new","Novo")]:[]));
  const client:HttpClient={request};
  const {result,rerender}=renderHook(({slug})=>useEquipmentCatalog({categoria:null,tenantSlug:slug}),{initialProps:{slug:"locadora-a"},wrapper:({children}:{children:ReactNode})=><ApiClientProvider client={client}>{children}</ApiClientProvider>});
  await waitFor(()=>expect(request).toHaveBeenCalledTimes(2));
  rerender({slug:"locadora-b"});await waitFor(()=>expect(result.current.equipments[0]?.id).toBe("new"));
  await act(async()=>{complete([equipment("old","Antigo")])});expect(result.current.equipments.map(item=>item.id)).toEqual(["new"]);
 });
});
