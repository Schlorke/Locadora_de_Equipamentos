// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminFilterCard } from "./FiltroAdmin";
afterEach(cleanup);
describe("Admin filter interactions",()=>{
 it("forwards search and clears configured filters exactly once",()=>{
   const onSearchChange=vi.fn(),onValueChange=vi.fn(),onReset=vi.fn();
   render(<AdminFilterCard layout="stacked" searchValue="serra" onSearchChange={onSearchChange} onReset={onReset} filters={[{label:"Status",value:"active",options:[{value:"active",label:"Ativo"},{value:"all",label:"Todos"}],onValueChange}]}/>);
   fireEvent.change(screen.getByPlaceholderText("Buscar..."),{target:{value:"andaime"}});
   expect(onSearchChange).toHaveBeenLastCalledWith("andaime");
   fireEvent.click(screen.getByTitle("Resetar filtros"));
   expect(onValueChange).toHaveBeenCalledExactlyOnceWith("all");expect(onSearchChange).toHaveBeenLastCalledWith("");expect(onReset).toHaveBeenCalledOnce();
 });
});
