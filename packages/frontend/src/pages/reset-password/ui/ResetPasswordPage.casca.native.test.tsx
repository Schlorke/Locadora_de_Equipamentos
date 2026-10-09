// @vitest-environment jsdom
// Redefinição de senha no app: a mesma casca do contrato (`shell`); na plataforma, o nome provisório no lugar da marca.
import { cleanup, render, screen } from "@testing-library/react";
import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { afterEach, describe, expect, it } from "vitest";
import { IdentidadePublicaProvider } from "../../../entities/organizacao";
import { ResetPasswordPage } from "./ResetPasswordPage.native";

afterEach(cleanup);

describe("ResetPasswordPage (native): casca", () => {
  // Achado 146: o teste anterior afirmava a sigla fixa "GB" no padrão; a sigla é a da própria locadora (cartão público).
  it("padrão: a sigla da própria locadora; sem locadora identificada, nenhuma sigla", () => {
    render(
      <IdentidadePublicaProvider value={{ nome: "Locadora Nova", cidade: null, uf: null, logoUrl: null }}>
        <ResetPasswordPage token="token-teste" />
      </IdentidadePublicaProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("LN");
    cleanup();
    render(<ResetPasswordPage token="token-teste" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("");
    expect(screen.queryByText("GB")).toBeNull();
  });

  it("plataforma: o nome provisório da plataforma", () => {
    render(
      <IdentidadePublicaProvider value={{ nome: "Locadora Nova", cidade: null, uf: null, logoUrl: null }}>
        <ResetPasswordPage token="token-teste" shell="platform" />
      </IdentidadePublicaProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(PLATFORM.displayName);
  });
});
