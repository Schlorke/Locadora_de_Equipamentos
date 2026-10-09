// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationSessionProvider, type ApplicationSession, type SessionState } from "../../../entities/sessao";
import { useAdminIndexRedirect, useAdminLoginRedirect } from "./use-session-redirect";

afterEach(cleanup);

function session(status: SessionState["status"], data: ApplicationSession = null): SessionState {
  return { status, data, update: async () => data, signOut: async () => undefined };
}
const member: ApplicationSession = { user: { id: "u1", email: "pessoa@example.test", role: "CLIENT" } };

function mount<T>(hook: () => T, initial: SessionState) {
  let value = initial;
  const wrapper = ({ children }: { children: ReactNode }) => <ApplicationSessionProvider value={value}>{children}</ApplicationSessionProvider>;
  const view = renderHook(hook, { wrapper });
  return { ...view, setSession(next: SessionState) { value = next; view.rerender(); } };
}

describe("useAdminIndexRedirect", () => {
  it("não navega enquanto a sessão carrega e navega uma única vez quando ela chega", () => {
    const first = vi.fn();
    let replace = first;
    const view = mount(() => useAdminIndexRedirect(replace), session("loading"));
    expect(view.result.current).toBeNull();
    expect(first).not.toHaveBeenCalled();
    view.setSession(session("authenticated", member));
    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith("/admin/dashboard");
    // O host pode recriar a função de navegação; o mesmo destino não é aplicado de novo.
    const second = vi.fn();
    replace = second;
    view.rerender();
    expect(second).not.toHaveBeenCalled();
  });

  it("anônimo segue para o login administrativo", () => {
    const replace = vi.fn();
    mount(() => useAdminIndexRedirect(replace), session("unauthenticated"));
    expect(replace).toHaveBeenCalledWith("/admin/login");
  });
});

describe("useAdminLoginRedirect", () => {
  it("espera a sessão e depois usa o login universal", () => {
    const replace = vi.fn();
    const view = mount(() => useAdminLoginRedirect(replace), session("loading"));
    expect(replace).not.toHaveBeenCalled();
    view.setSession(session("unauthenticated"));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
