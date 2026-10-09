import { describe, expect, it } from "vitest";
import { PANEL_HOME, resolvePanelCallback } from "./panel-callback";

describe("resolvePanelCallback (login da equipe no host app)", () => {
  it("sem callback, o índice do painel", () => {
    expect(PANEL_HOME).toBe("/admin");
    expect(resolvePanelCallback(null)).toBe("/admin");
    expect(resolvePanelCallback(undefined)).toBe("/admin");
    expect(resolvePanelCallback("")).toBe("/admin");
  });

  it("aceita caminho interno do painel, com query e âncora", () => {
    expect(resolvePanelCallback("/admin")).toBe("/admin");
    expect(resolvePanelCallback("/admin/rentals")).toBe("/admin/rentals");
    expect(resolvePanelCallback("/admin/orcamentos/q1?status=novo#itens")).toBe("/admin/orcamentos/q1?status=novo#itens");
    expect(resolvePanelCallback("%2Fadmin%2Fdashboard")).toBe("/admin/dashboard");
  });

  it.each([
    "https://evil.example/admin",
    "//evil.example/admin",
    "/\\evil.example/admin",
    "http:/evil.example",
    "javascript:alert(1)",
    "/%2F%2Fevil.example/admin",
    "admin/dashboard",
  ])("recusa outra origem ou esquema: %s", (callbackUrl) => {
    expect(resolvePanelCallback(callbackUrl)).toBe("/admin");
  });

  it.each([
    "/",
    "/area-cliente",
    "/login",
    "/administrador",
    "/admin-login",
    "/admin/../area-cliente",
    "/admin/%2e%2e/area-cliente",
    "/admin/%252e%252e/area-cliente",
    "/admin%2F..%2Farea-cliente",
  ])("recusa destino fora do painel: %s", (callbackUrl) => {
    expect(resolvePanelCallback(callbackUrl)).toBe("/admin");
  });

  it("recusa a própria entrada da equipe (/admin/login), que só levaria de volta ao login", () => {
    expect(resolvePanelCallback("/admin/login")).toBe("/admin");
    expect(resolvePanelCallback("/admin/login?callbackUrl=/admin/rentals")).toBe("/admin");
  });

  it("recusa caminho que ainda mudaria numa segunda decodificação (o login decodifica de novo)", () => {
    expect(resolvePanelCallback("/admin/%25252e%25252e%25252flogin")).toBe("/admin");
    expect(resolvePanelCallback("/admin/x%2520y")).toBe("/admin");
  });
});
