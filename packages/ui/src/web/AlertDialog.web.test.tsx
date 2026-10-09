// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
import { AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogAction,AlertDialogCancel } from "./AlertDialog.web";
afterEach(cleanup);
describe("Confirmation actions",()=>{
 it("retains distinct cancel/confirm handlers and original button variants",()=>{
  const confirm=vi.fn(),cancel=vi.fn();
  render(<AlertDialog open><AlertDialogContent><AlertDialogTitle>Incluir finais de semana?</AlertDialogTitle><AlertDialogDescription>Deseja incluir os finais de semana na contagem de dias?</AlertDialogDescription><AlertDialogCancel onClick={cancel}>Não, apenas dias úteis</AlertDialogCancel><AlertDialogAction onClick={confirm}>Sim, incluir finais de semana</AlertDialogAction></AlertDialogContent></AlertDialog>);
  const no=screen.getByRole("button",{name:"Não, apenas dias úteis"}),yes=screen.getByRole("button",{name:"Sim, incluir finais de semana"});
  expect(no.className).toContain("border-gray-200");expect(yes.className).toContain("bg-slate-700");
  fireEvent.click(no);expect(cancel).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled();
 });
});
