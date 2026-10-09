// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientProvider } from "../../../shared/api";
import { useRegistration } from "./use-registration";

afterEach(cleanup);
describe("cadastro compartilhado", () => {
  it("exige documento, conserva telefone/CPF no payload e redireciona após resposta", async () => {
    const request = vi.fn().mockResolvedValue({ success: true });
    const push = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(ApiClientProvider, { client: { request }, children });
    const { result } = renderHook(() => useRegistration({ push, callbackUrl: "/orcamento", signInProvider: vi.fn() }), { wrapper });
    act(() => {
      result.current.changeField("name", "Test");
      result.current.changeField("email", "test@example.test");
      result.current.changeField("phone", "51999999999");
      result.current.changeField("password", "password");
      result.current.changeField("confirmPassword", "password");
    });
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toContain("CPF ou CNPJ");
    expect(request).not.toHaveBeenCalled();
    act(() => { result.current.changeField("cpf", "12345678901"); });
    await act(async () => { await result.current.submit(); });
    const body = JSON.parse(request.mock.calls[0][1].body);
    expect(body).toMatchObject({ phone: "(51) 99999-9999", cpf: "123.456.789-01" });
    expect(body).not.toHaveProperty("confirmPassword");
    expect(push).toHaveBeenCalledWith("/login?registered=true&callbackUrl=%2Forcamento");
  });
});
