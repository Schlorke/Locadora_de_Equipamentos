// @vitest-environment jsdom
import {act,cleanup,renderHook} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const notifications=vi.hoisted(()=>({success:vi.fn(),error:vi.fn()}));
vi.mock("../../../shared/lib",()=>({toast:notifications}));
import {useIconCustomization} from "../model/use-icon-customization";
afterEach(()=>{cleanup();localStorage.clear();vi.clearAllMocks()});
describe("Shared icon customization",()=>{
 it("rejects oversized SVG without reading it",async()=>{
  const {result}=renderHook(useIconCustomization),text=vi.fn();
  await act(async()=>result.current.handleFileUpload({name:"oversized.svg",type:"image/svg+xml",size:65537,text}));
  expect(text).not.toHaveBeenCalled();expect(result.current.blockProps.uploadError).toBe("Use um arquivo SVG com até 64kb.");expect(result.current.blockProps.hasUploadedIcon).toBe(false);
 });
 it("sanitizes an uploaded SVG and saves its explicit name",async()=>{
  const {result}=renderHook(useIconCustomization);
  await act(async()=>result.current.handleFileUpload({name:"equipment.svg",type:"image/svg+xml",size:100,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg" onload="unsafe()"><script>unsafe()</script><path d="M0 0"/></svg>'}));
  expect(result.current.blockProps.design.customIcon.svgContent).not.toContain("script");expect(result.current.blockProps.design.customIcon.svgContent).not.toContain("onload");expect(result.current.blockProps.hasUploadedIcon).toBe(true);
  act(()=>result.current.blockProps.onCustomIconNameChange("Meu equipamento"));act(()=>result.current.blockProps.onSaveCustomIcon());
  expect(result.current.blockProps.design.customIcon.name).toBe("Meu equipamento");expect(result.current.blockProps.activeTab).toBe("icons");expect(notifications.success).toHaveBeenCalledWith("Ícone personalizado salvo!",{description:"Meu equipamento"});
 });
});
