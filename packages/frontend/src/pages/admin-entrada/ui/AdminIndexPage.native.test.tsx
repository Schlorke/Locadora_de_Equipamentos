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
import { AdminIndexPage } from "./AdminIndexPage.native";

afterEach(cleanup);

function renderWith(status: SessionState["status"], data: ApplicationSession = null) {
  const replace = vi.fn();
  const value: SessionState = { status, data, update: async () => data, signOut: async () => undefined };
  const view = render(<ApplicationSessionProvider value={value}><AdminIndexPage replace={replace} /></ApplicationSessionProvider>);
  return { replace, view };
}

describe("AdminIndexPage (native)", () => {
  it("carregando: mostra o estado e não navega", () => {
    const { replace } = renderWith("loading");
    expect(screen.getByRole("status").textContent).toBe("Redirecionando...");
    expect(replace).not.toHaveBeenCalled();
  });

  it("autenticado: substitui a rota pelo dashboard administrativo", () => {
    const { replace } = renderWith("authenticated", { user: { id: "u1", email: "pessoa@example.test", role: "ADMIN" } });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("não autenticado: substitui a rota pelo login administrativo", () => {
    const { replace } = renderWith("unauthenticated");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/admin/login");
  });
});
