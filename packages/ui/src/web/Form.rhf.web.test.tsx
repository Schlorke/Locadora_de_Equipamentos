// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./Form.web";

afterEach(cleanup);

function ClienteForm({ onSubmit }: { onSubmit: (_values: { nome: string }) => void }) {
  const form = useForm<{ nome: string }>({ defaultValues: { nome: "" } });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="nome"
          rules={{ required: "Informe o nome" }}
          render={({ field }) => (
            <FormItem data-testid="item">
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <input {...field} />
              </FormControl>
              <FormDescription>Como aparece no contrato</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Salvar</button>
      </form>
    </Form>
  );
}

describe("Form (RHF)", () => {
  it("mantém FormProvider/Controller e text-destructive no web", async () => {
    const onSubmit = vi.fn();
    render(<ClienteForm onSubmit={onSubmit} />);
    expect(screen.getByTestId("item").className).toContain("space-y-2");
    const input = screen.getByLabelText("Nome");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByText("Como aparece no contrato").id);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const message = await screen.findByText("Informe o nome");
    expect(message.className).toContain("text-destructive");
    expect(screen.getByText("Nome").className).toContain("text-destructive");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "Construtora Alfa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ nome: "Construtora Alfa" });
    expect(screen.queryByText("Informe o nome")).toBeNull();
  });
});
