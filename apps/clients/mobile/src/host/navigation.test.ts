import { describe, expect, it, vi } from "vitest";
import { createHostNavigation, isPrivateAreaPath } from "./navigation";

function setup(resolveHref?: (href: string) => string) {
  const router = { push: vi.fn(), replace: vi.fn() };
  const openURL = vi.fn(async () => true);
  return { router, openURL, navigation: createHostNavigation({ router, openURL, resolveHref }) };
}

describe("createHostNavigation", () => {
  it("entrega as URLs web ao expo-router sem tradução, preservando query e hash", async () => {
    const { router, navigation } = setup();
    for (const href of ["/admin/login", "/auth/callback?callbackUrl=%2Fequipamentos", "/admin", "/admin/permissions", "/area-cliente#dashboard-banner"]) {
      await navigation.push(href);
      expect(router.push).toHaveBeenLastCalledWith(href);
    }
    await navigation.replace("/admin/dashboard");
    expect(router.replace).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("não reintroduz os aliases antigos das telas planas", async () => {
    const { router, navigation } = setup();
    await navigation.push("/admin/login");
    await navigation.push("/auth/callback");
    expect(router.push.mock.calls.flat()).not.toContain("/admin-login");
    expect(router.push.mock.calls.flat()).not.toContain("/auth-callback");
  });

  it("aplica o resolvedor de locadora pública antes de navegar", async () => {
    const { router, navigation } = setup((href) => href + "?tenantSlug=locadora-a");
    await navigation.push("/equipamentos");
    expect(router.push).toHaveBeenCalledWith("/equipamentos?tenantSlug=locadora-a");
  });

  it("abre links externos pelo sistema e não pelo roteador", async () => {
    const { router, openURL, navigation } = setup((href) => href + "?tenantSlug=x");
    await navigation.push("https://example.test/termos");
    await navigation.replace("mailto:contato@example.test");
    await navigation.push("TEL:+5500000000");
    expect(openURL.mock.calls).toEqual([["https://example.test/termos"], ["mailto:contato@example.test"], ["TEL:+5500000000"]]);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("isPrivateAreaPath", () => {
  it("/admin e /admin/login decidem o destino pela sessão e não exigem locadora", () => {
    expect(isPrivateAreaPath("/admin")).toBe(false);
    expect(isPrivateAreaPath("/admin/login")).toBe(false);
  });

  it("demais rotas administrativas e a área do cliente exigem sessão e locadora", () => {
    for (const path of ["/admin/dashboard", "/admin/permissions", "/admin/teste-toast", "/area-cliente", "/area-cliente/perfil"]) {
      expect(isPrivateAreaPath(path)).toBe(true);
    }
  });

  it("rotas públicas e de autenticação continuam abertas", () => {
    for (const path of ["/", "/login", "/entrar", "/auth/callback", "/equipamentos", "/administracao", "/area-clientela"]) {
      expect(isPrivateAreaPath(path)).toBe(false);
    }
  });
});
