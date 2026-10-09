// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { catalog, type CatalogRecipeId } from "@gb-locacoes/ui";
import { CatalogRecipe } from "./CatalogRecipe";
beforeAll(()=>{
 window.matchMedia=vi.fn().mockImplementation(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn()}));
 class Observer {observe(){}unobserve(){}disconnect(){}}
 vi.stubGlobal("ResizeObserver",Observer);vi.stubGlobal("IntersectionObserver",Observer);
 Element.prototype.scrollIntoView=vi.fn();Element.prototype.hasPointerCapture=()=>false;Element.prototype.setPointerCapture=vi.fn();Element.prototype.releasePointerCapture=vi.fn();
 vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({x:0,y:0,width:640,height:320,top:0,left:0,right:640,bottom:320,toJSON:()=>({})});
});
afterEach(cleanup);
describe("web catalog recipes",()=>{
 for(const [id,recipe] of Object.entries(catalog)) for(const state of recipe.states) it(`${id}/${state} mounts the actual composition`,()=>{
  const {container}=render(<CatalogRecipe recipe={id as CatalogRecipeId} state={state}/>);
  // The first child is the example; the status label is a separate sibling.
  expect(container.firstElementChild?.firstChild?.nodeName).toBeTruthy();
  expect(container.firstElementChild?.firstChild?.nodeName).not.toBe("#comment");
  expect(container.firstElementChild?.childNodes.length).toBeGreaterThan(1);
 });
 it("executes the button action and keeps disabled actions inert",()=>{
  const instance=render(<CatalogRecipe recipe="Button" state="default"/>);
  fireEvent.click(screen.getByRole("button",{name:"Exemplo"}));expect(screen.getByText("Ação executada")).toBeTruthy();
  instance.unmount();render(<CatalogRecipe recipe="Button" state="disabled"/>);
  fireEvent.click(screen.getByRole("button",{name:"Exemplo"}));expect(screen.queryByText("Ação executada")).toBeNull();
 });
 it("validates the real form controller",async()=>{
  render(<CatalogRecipe recipe="Form" state="default"/>);fireEvent.click(screen.getByRole("button",{name:"Validar"}));
  expect(await screen.findByText("Preencha o nome")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"),{target:{value:"Pessoa"}});fireEvent.click(screen.getByRole("button",{name:"Validar"}));
  await waitFor(()=>expect(screen.queryByText("Preencha o nome")).toBeNull());
 });
 it("opens and closes the dialog using its composed controls",async()=>{
  render(<CatalogRecipe recipe="Dialog" state="closed"/>);expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Abrir diálogo"}));expect(await screen.findByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 });
 it("changes controlled checkbox and tabs state",()=>{
  const instance=render(<CatalogRecipe recipe="Checkbox" state="unchecked"/>);fireEvent.click(screen.getByRole("checkbox"));expect(screen.getByText("Marcado")).toBeTruthy();instance.unmount();
  render(<CatalogRecipe recipe="Tabs" state="first"/>);fireEvent.mouseDown(screen.getByRole("tab",{name:"Segunda aba"}),{button:0});expect(screen.getByText("Conteúdo da segunda aba")).toBeTruthy();
 });
});
