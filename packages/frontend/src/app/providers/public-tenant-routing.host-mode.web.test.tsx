// @vitest-environment jsdom
// Modo host de ponta a ponta no frontend: usePublicTenantRouting({mode:'host'}) → AppProviders → páginas.
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { Link } from "@gb-locacoes/ui";
import { MotionGlobalConfig } from "framer-motion";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppProviders, usePublicTenantRouting, type PublicTenantRoutingOptions, type PublicTenantStorage } from "../index.web";
import { EquipamentosPage } from "../../pages/equipamentos";
import { useVisiblePathname } from "../../shared/lib/navigation/use-visible-pathname.web";
import { useClientAreaBadge } from "../../features/selo-area-cliente";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => router.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../pages/equipamentos/model/use-equipment-catalog", async (importOriginal) => {
  const equipments = [{ id: "eq-1", name: "Betoneira 400L", description: "", pricePerDay: 100, images: [], isAvailable: true, category: { id: "c", name: "Concreto" } }];
  return {
    ...(await importOriginal<typeof import("../../pages/equipamentos/model/use-equipment-catalog")>()),
    useEquipmentCatalog: () => ({
      equipments, categories: [], filteredEquipments: equipments, currentEquipments: equipments, isLoading: false, error: null,
      searchTerm: "", setSearchTerm: () => {}, categoryFilter: "all", handleCategoryChange: () => {}, filterKey: 0, currentPage: 1,
      totalPages: 1, pageKey: 0, changePage: () => {}, fetchData: () => {},
    }),
  };
});

const noStorage: PublicTenantStorage = { getItem: () => null, setItem: () => undefined };

function PathProbe() {
  const pathname = useVisiblePathname();
  const { isInClientArea } = useClientAreaBadge();
  return <output data-testid="path">{`${pathname}|${isInClientArea}`}</output>;
}

function Site({ options }: { options: PublicTenantRoutingOptions }) {
  const routing = usePublicTenantRouting(options);
  return (
    <AppProviders navigate={() => {}} {...routing}>
      <PathProbe />
      <Link href="/sobre">Sobre</Link>
      {/* Link para a raiz, como o "Início" de uma página legal (o LegalPageLayout órfão saiu do pacote). */}
      <Link href="/">Início</Link>
      <EquipamentosPage
        categoria={null}
        tenantSlug={routing.publicTenantSlug}
        image={({ alt }) => <span>{alt}</span>}
        link={({ href, children }) => <a href={href}>{children}</a>}
        filterCard={() => null}
        pagination={() => null}
        categoryBadge={(category) => <span>{category.name}</span>}
      />
    </AppProviders>
  );
}

const hrefs = () => [...document.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href") ?? "");

beforeAll(() => { MotionGlobalConfig.skipAnimations = true; });
afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
afterEach(() => { cleanup(); router.pathname = "/"; });

describe("frontend em modo host", () => {
  it("nenhum href da árvore leva ?tenantSlug=", () => {
    router.pathname = "/locadora-a/equipamentos";
    render(<Site options={{ mode: "host", pathname: router.pathname, tenantSlug: "locadora-a" }} />);
    expect(hrefs().length).toBeGreaterThanOrEqual(4);
    expect(hrefs().filter((href) => href.includes("tenantSlug"))).toEqual([]);
    expect(hrefs()).toEqual(expect.arrayContaining(["/sobre", "/equipamentos/eq-1", "/"]));
  });

  it("o caminho visível sai igual no servidor (caminho interno) e no navegador", () => {
    router.pathname = "/locadora-a/area-cliente";
    const server = renderToString(<Site options={{ mode: "host", pathname: router.pathname, tenantSlug: "locadora-a" }} />);
    expect(server).toContain("/area-cliente|true");
    expect(server).not.toContain("/locadora-a/area-cliente|");
    router.pathname = "/area-cliente";
    render(<Site options={{ mode: "host", pathname: router.pathname, tenantSlug: "locadora-a" }} />);
    expect(screen.getByTestId("path").textContent).toBe("/area-cliente|true");
  });

  it("modo legado continua acrescentando a locadora pública (orfaos-295b)", () => {
    const { result } = renderHook(() => usePublicTenantRouting({ pathname: "/", explicitSlug: "locadora-a", storage: noStorage, applySlug: () => {} }));
    expect(result.current.resolveHref("/sobre")).toBe("/sobre?tenantSlug=locadora-a");
    render(<Site options={{ pathname: "/equipamentos", explicitSlug: "locadora-a", storage: noStorage, applySlug: () => {} }} />);
    expect(hrefs()).toEqual(expect.arrayContaining(["/sobre?tenantSlug=locadora-a", "/equipamentos/eq-1?tenantSlug=locadora-a", "/?tenantSlug=locadora-a"]));
  });
});
