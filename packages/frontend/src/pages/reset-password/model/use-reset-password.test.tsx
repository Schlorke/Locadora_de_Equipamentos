// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientProvider } from "../../../shared/api";
import { useResetPassword } from "./use-reset-password";

afterEach(cleanup);
describe("redefinição de senha", () => {
  it("não chama API sem token ou com senhas diferentes", async () => {
    const request = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(ApiClientProvider, { client: { request }, children });
    const missing = renderHook(() => useResetPassword(), { wrapper });
    await act(async () => { await missing.result.current.submit(); });
    expect(missing.result.current.error).toContain("Link invalido");
    const mismatch = renderHook(() => useResetPassword("token-fixture"), { wrapper });
    act(() => { mismatch.result.current.setPassword("password"); mismatch.result.current.setConfirmPassword("another"); });
    await act(async () => { await mismatch.result.current.submit(); });
    expect(mismatch.result.current.error).toContain("nao conferem");
    expect(request).not.toHaveBeenCalled();
  });
  it("envia token e senha pelo client injetado e só então mostra sucesso", async () => {
    const request = vi.fn().mockResolvedValue({ success: true });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(ApiClientProvider, { client: { request }, children });
    const { result } = renderHook(() => useResetPassword(" token-fixture "), { wrapper });
    act(() => { result.current.setPassword("password"); result.current.setConfirmPassword("password"); });
    await act(async () => { await result.current.submit(); });
    expect(request).toHaveBeenCalledWith("/api/auth/reset-password", expect.objectContaining({ body: JSON.stringify({ token: "token-fixture", password: "password" }) }));
    expect(result.current.isSuccess).toBe(true);
  });
});
