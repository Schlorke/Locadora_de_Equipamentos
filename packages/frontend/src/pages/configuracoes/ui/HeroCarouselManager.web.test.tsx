// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroCarouselManager } from "./HeroCarouselManager.web";
afterEach(cleanup);
describe("Hero carousel manager",()=>{
 it("adds an editable carousel item without replacing existing entries",()=>{
   const onChange=vi.fn();render(<HeroCarouselManager items={[]} onChange={onChange}/>);
   expect(screen.getByText("Nenhum item no carousel")).toBeTruthy();
   fireEvent.click(screen.getByRole("button",{name:"Adicionar Item"}));
   expect(onChange).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({id:expect.any(String),title:"",imageUrl:"",description:"",link:"",order:0})]);
 });
});
