// @vitest-environment jsdom
// Login no app: a mesma casca do contrato (`shell`). Na plataforma, o nome provisório no lugar da marca e do rodapé
// da locadora; no padrão, nada muda.
import { cleanup, render, screen } from "@testing-library/react";
import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { afterEach, describe, expect, it } from "vitest";
import { IdentidadePublicaProvider } from "../../../entities/organizacao";
import { LoginPage } from "./LoginPage.native";

const adapter = { getSession: async () => null, signInCredentials: async () => ({ ok: true }), replace: () => undefined };

afterEach(cleanup);

describe("LoginPage (native): casca", () => {
  // Achado 143: a marca e o rodapé são os da própria locadora (cartão público); o teste anterior afirmava os da GB.
  it("padrão: a marca e o rodapé da locadora", () => {
    render(
      <IdentidadePublicaProvider value={{ nome: "Locadora A", cidade: null, uf: null, logoUrl: null }}>
        <LoginPage {...adapter} />
      </IdentidadePublicaProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("LA");
    expect(screen.getByText("© 2024 Locadora A - Sistema de Acesso")).toBeTruthy();
    expect(screen.queryByText(/GB Locações/)).toBeNull();
  });

  it("plataforma: o nome provisório da plataforma no lugar da marca e do rodapé", () => {
    render(<LoginPage {...adapter} allowSignUp={false} shell="platform" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(PLATFORM.displayName);
    expect(screen.getByText(`${PLATFORM.displayName} - Sistema de Acesso`)).toBeTruthy();
    expect(screen.queryByText(/GB Locações/)).toBeNull();
  });
});
