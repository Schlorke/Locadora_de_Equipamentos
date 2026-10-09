import { describe, expect, it } from "vitest";
import {
  HEADER_NAVIGATION,
  buildHeaderUserMenu,
  getHeaderFirstName,
  getHeaderUserInitials,
  isHeaderActivePage,
  isHeaderStaff,
  shouldAdjustClientAreaScroll,
  shouldAdjustMobileClientMenu,
} from "./usuario";

describe("usuário do cabeçalho", () => {
  it("usa U e Cliente quando o nome vem vazio", () => {
    expect(getHeaderUserInitials(null)).toBe("U");
    expect(getHeaderUserInitials("   ")).toBe("U");
    expect(getHeaderFirstName(undefined)).toBe("Cliente");
    expect(getHeaderFirstName("  ")).toBe("Cliente");
  });

  it("monta iniciais e o primeiro nome", () => {
    expect(getHeaderUserInitials("ana silva")).toBe("AS");
    expect(getHeaderUserInitials("JOÃO")).toBe("J");
    expect(getHeaderFirstName("JOÃO")).toBe("João");
    expect(getHeaderFirstName("ana silva")).toBe("Ana");
  });

  it("marca a home só na raiz e o restante pelo prefixo", () => {
    expect(isHeaderActivePage(null, "/")).toBe(false);
    expect(isHeaderActivePage("/equipamentos", "/")).toBe(false);
    expect(isHeaderActivePage("/", "/")).toBe(true);
    expect(isHeaderActivePage("/equipamentos/andaime", "/equipamentos")).toBe(true);
    expect(isHeaderActivePage("/orcamento", "/equipamentos")).toBe(false);
  });

  it("trata ADMIN, OPERATOR e FINANCIAL como equipe", () => {
    expect(isHeaderStaff("ADMIN")).toBe(true);
    expect(isHeaderStaff("OPERATOR")).toBe(true);
    expect(isHeaderStaff("FINANCIAL")).toBe(true);
    expect(isHeaderStaff("CLIENT")).toBe(false);
    expect(isHeaderStaff(null)).toBe(false);
  });

  it("lista Início, Equipamentos, Orçamento, Sobre e Contato", () => {
    expect(HEADER_NAVIGATION.map((item) => item.name)).toEqual([
      "Início",
      "Equipamentos",
      "Orçamento",
      "Sobre",
      "Contato",
    ]);
    expect(HEADER_NAVIGATION.map((item) => item.href)).toEqual([
      "/",
      "/equipamentos",
      "/orcamento",
      "/sobre",
      "/contato",
    ]);
  });

  it("coloca o painel admin só para a equipe e mantém o selo em notificações", () => {
    const client = buildHeaderUserMenu(false);
    expect(client[0]).toEqual({ href: "/area-cliente", label: "Dashboard" });
    expect(client.some((item) => item.href === "/admin")).toBe(false);
    expect(client.find((item) => item.href === "/area-cliente/notificacoes")?.showBadge).toBe(true);
    expect(client.map((item) => item.label)).toEqual([
      "Dashboard",
      "Notificações",
      "Meu Perfil",
      "Meus Orçamentos",
      "Endereços",
      "Suporte",
    ]);

    const staff = buildHeaderUserMenu(true);
    expect(staff[0]).toEqual({ href: "/admin", label: "Painel Administrador" });
    expect(shouldAdjustClientAreaScroll("/orcamento")).toBe(true);
    expect(shouldAdjustClientAreaScroll("/area-cliente/perfil")).toBe(false);
    expect(shouldAdjustMobileClientMenu(true, "/area-cliente")).toBe(true);
    expect(shouldAdjustMobileClientMenu(false, "/area-cliente")).toBe(false);
    expect(shouldAdjustMobileClientMenu(true, "/contato")).toBe(false);
  });
});
