// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmAddressDialog } from "./ConfirmarEndereco.web";
afterEach(cleanup);
const address={id:"address-1",street:"Rua Teste",number:"10",complement:null,neighborhood:"Centro",city:"Cidade",state:"RS",zipCode:"90000000"};
describe("Address confirmation",()=>{
 it("passes the preference only when confirming and calls cancel separately",()=>{
  const onConfirm=vi.fn(),onCancel=vi.fn(),onDismissChange=vi.fn();
  render(<ConfirmAddressDialog open onOpenChange={()=>{}} address={address} onConfirm={onConfirm} onCancel={onCancel} onDismissChange={onDismissChange}/>);
  expect(screen.getByText(/Rua Teste/)).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox",{name:"Não exibir novamente"}));
  fireEvent.click(screen.getByRole("button",{name:"Confirmar"}));
  expect(onDismissChange).toHaveBeenCalledExactlyOnceWith(true);expect(onConfirm).toHaveBeenCalledOnce();expect(onCancel).not.toHaveBeenCalled();
 });
});
