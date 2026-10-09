// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePublicTenantRouting, type HostPublicTenantRoutingOptions, type LegacyPublicTenantRoutingOptions, type PublicTenantStorage } from "../index";
import type { TenantContext } from "../../entities/organizacao";

function memoryStorage(initial: Record<string, string> = {}, async = false) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => (async ? Promise.resolve(values.get(key) ?? null) : values.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  } satisfies PublicTenantStorage;
  return { storage, values };
}

function setup(options: Partial<LegacyPublicTenantRoutingOptions> & Pick<LegacyPublicTenantRoutingOptions, "storage">) {
  const applySlug = vi.fn();
  const hook = renderHook((props: LegacyPublicTenantRoutingOptions) => usePublicTenantRouting(props), {
    initialProps: { pathname: "/", explicitSlug: null, applySlug, ...options },
  });
  return { ...hook, applySlug };
}

function setupHost(options: Partial<HostPublicTenantRoutingOptions> = {}) {
  return renderHook((props: HostPublicTenantRoutingOptions) => usePublicTenantRouting(props), {
    initialProps: { mode: "host", pathname: "/", tenantSlug: "locadora-a", ...options },
  });
}

const PRIVATE_AREA_TABLE: Array<[string, boolean, boolean]> = [
  ["/", false, false],
  ["/equipamentos", false, false],
  ["/sobre", false, false],
  ["/orcamento", false, true],
  ["/admin", true, true],
  ["/admin/orcamentos/1", true, true],
  ["/admin/login", false, false],
  ["/admin/entrada", false, false],
  ["/admin-login", false, false],
  ["/admin-entrada", false, false],
  ["/admin-permissions", true, true],
  ["/area-cliente", true, true],
  ["/perfil/editar", true, true],
  ["/perfilx", false, false],
  ["/enderecos", true, true],
  ["/historico/abc", true, true],
];

afterEach(() => cleanup());

describe("usePublicTenantRouting", () => {
  it.each(PRIVATE_AREA_TABLE)("%s → privateArea=%s, awaitSession=%s", (pathname, privateArea, awaitSession) => {
    const { result } = setup({ pathname, storage: memoryStorage().storage });
    expect(result.current.privateArea).toBe(privateArea);
    expect(result.current.awaitSession).toBe(awaitSession);
    expect(result.current.internalRoutePrefix).toBeNull();
  });

  it("não lê a memória nem reescreve a URL enquanto o host ainda não leu a query da rota", async () => {
    const { storage } = memoryStorage({ "public-tenant-slug": "lembrada" });
    const { result, applySlug } = setup({ explicitSlug: undefined, storage });
    await act(async () => { await Promise.resolve(); });
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(applySlug).not.toHaveBeenCalled();
    expect(result.current.publicTenantSlug).toBeNull();
  });

  it("slug explícito na URL vence e é lembrado", async () => {
    const { storage, values } = memoryStorage({ "public-tenant-slug": "antiga" });
    const { result, applySlug } = setup({ explicitSlug: "locadora-a", storage });
    expect(result.current.publicTenantSlug).toBe("locadora-a");
    expect(result.current.resolveHref("/sobre")).toBe("/sobre?tenantSlug=locadora-a");
    await waitFor(() => expect(values.get("public-tenant-slug")).toBe("locadora-a"));
    expect(applySlug).not.toHaveBeenCalled();
  });

  it("sem slug na URL, restaura a locadora lembrada e a reflete na URL (storage assíncrono do native)", async () => {
    const { storage } = memoryStorage({ "public-tenant-slug": "locadora-b" }, true);
    const { result, applySlug } = setup({ explicitSlug: null, storage });
    await waitFor(() => expect(result.current.publicTenantSlug).toBe("locadora-b"));
    expect(applySlug).toHaveBeenCalledWith("locadora-b");
    expect(result.current.resolveHref("/equipamentos?categoria=x")).toBe("/equipamentos?categoria=x&tenantSlug=locadora-b");
  });

  it("selecionar uma locadora lembra e reflete a escolha", async () => {
    const { storage, values } = memoryStorage();
    const { result, applySlug } = setup({ explicitSlug: null, storage });
    act(() => { result.current.onTenantSelected({ tenant: { id: "t-c", slug: "locadora-c" } } as TenantContext); });
    expect(result.current.publicTenantSlug).toBe("locadora-c");
    expect(applySlug).toHaveBeenCalledWith("locadora-c");
    expect(values.get("public-tenant-slug")).toBe("locadora-c");
  });
});

describe("usePublicTenantRouting no modo host", () => {
  it("usa o slug fixo do host e não acrescenta ?tenantSlug= a nenhum href", () => {
    const { result } = setupHost({ pathname: "/equipamentos" });
    expect(result.current.publicTenantSlug).toBe("locadora-a");
    expect(result.current.internalRoutePrefix).toBe("/locadora-a");
    for (const href of ["/", "/sobre", "/equipamentos?categoria=x", "/equipamentos/eq-1#fotos", "/orcamento?equipmentId=eq-1", "/login?callbackUrl=%2Fequipamentos"]) {
      expect(result.current.resolveHref(href)).toBe(href);
      expect(result.current.resolveHref(href)).not.toContain("tenantSlug");
    }
  });

  it("não lê nem grava armazenamento e ignora a seleção de locadora", async () => {
    const { result } = setupHost();
    const selection = { tenant: { id: "t-b", slug: "locadora-b" } } as TenantContext;
    act(() => { result.current.onTenantSelected(selection); });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.publicTenantSlug).toBe("locadora-a");
    expect(result.current.resolveHref("/sobre")).toBe("/sobre");
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
  });

  it.each(PRIVATE_AREA_TABLE)("%s com ou sem o prefixo interno → privateArea=%s, awaitSession=%s", (pathname, privateArea, awaitSession) => {
    // No servidor o roteador pode informar o caminho interno do rewrite; no navegador, o visível.
    for (const informed of [pathname, "/locadora-a" + (pathname === "/" ? "" : pathname)]) {
      const { result, unmount } = setupHost({ pathname: informed });
      expect(result.current.privateArea).toBe(privateArea);
      expect(result.current.awaitSession).toBe(awaitSession);
      unmount();
    }
  });

  it("modo legado continua acrescentando a locadora pública (sem regressão)", () => {
    const { result } = setup({ explicitSlug: "locadora-a", storage: memoryStorage().storage });
    expect(result.current.resolveHref("/equipamentos/eq-1")).toBe("/equipamentos/eq-1?tenantSlug=locadora-a");
  });
});
