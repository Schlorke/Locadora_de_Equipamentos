// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children, accessibilityRole }: { children?: ReactNode; accessibilityRole?: string }) => <span role={accessibilityRole}>{children}</span>,
  ActivityIndicator: () => <span aria-hidden="true" />,
}));

import { ApplicationSessionProvider, type ApplicationSession, type SessionState } from "../../../entities/sessao";
import { AdminLoginPage } from "./AdminLoginPage.native";

afterEach(cleanup);

function renderWith(status: SessionState["status"], data: ApplicationSession = null) {
  const replace = vi.fn();
  const value: SessionState = { status, data, update: async () => data, signOut: async () => undefined };
  render(<ApplicationSessionProvider value={value}><AdminLoginPage replace={replace} /></ApplicationSessionProvider>);
  return replace;
}

describe("AdminLoginPage (native)", () => {
  it("carregando: mostra o estado e não navega", () => {
    const replace = renderWith("loading");
    expect(screen.getByRole("status").textContent).toBe("Redirecionando...");
    expect(replace).not.toHaveBeenCalled();
  });

  it("autenticado: segue para o login universal, que decide pela sessão existente", () => {
    const replace = renderWith("authenticated", { user: { id: "u1", email: "pessoa@example.test", role: "CLIENT" } });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("não autenticado: segue para o login universal", () => {
    const replace = renderWith("unauthenticated");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
