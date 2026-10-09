// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectAddressDialog } from "./SelecionarEndereco.web";
afterEach(cleanup);
describe("Address selection",()=>{
 it("selects the displayed id and keeps other-address and cancel as separate actions",()=>{
  const onSelect=vi.fn(),onUseOther=vi.fn(),onCancel=vi.fn();
  render(<SelectAddressDialog open onOpenChange={()=>{}} addresses={[{id:"address-2",street:"Rua Segunda",number:"20",complement:null,neighborhood:"Centro",city:"Cidade",state:"RS",zipCode:"90000000",isPrimary:true}]} onSelect={onSelect} onUseOther={onUseOther} onCancel={onCancel}/>);
  expect(screen.getByText("Principal")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:/Rua Segunda/}));expect(onSelect).toHaveBeenCalledExactlyOnceWith("address-2");
  fireEvent.click(screen.getByRole("button",{name:"Usar outro endereço"}));expect(onUseOther).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));expect(onCancel).toHaveBeenCalledOnce();
 });
});
