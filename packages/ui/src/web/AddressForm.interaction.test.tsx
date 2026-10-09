// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressForm } from "./AddressForm.web";

afterEach(cleanup);

describe("AddressForm lookup adapter", () => {
  it("consulta o adapter e entrega o endereço preenchido ao consumidor", async () => {
    const value = { cep: "", logradouro: "", numero: "25", complemento: "", bairro: "", cidade: "", estado: "" };
    const onChange = vi.fn();
    const lookupAddress = vi.fn().mockResolvedValue({ logradouro: "Rua de Teste", complemento: "Bloco A", bairro: "Centro", localidade: "Porto Alegre", uf: "RS" });
    render(createElement(AddressForm, { value, onChange, lookupAddress }));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "90000000" } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...value, cep: "90000-000", logradouro: "Rua de Teste", complemento: "Bloco A", bairro: "Centro", cidade: "Porto Alegre", estado: "RS" }));
    expect(lookupAddress).toHaveBeenCalledWith("90000-000");
  });
});
