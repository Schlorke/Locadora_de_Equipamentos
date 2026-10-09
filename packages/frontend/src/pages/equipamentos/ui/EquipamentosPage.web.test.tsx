// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withPublicTenant } from "../../../entities/organizacao";
import { HrefResolverProvider, type HrefResolver } from "../../../shared/lib/navigation";
import type { Equipment } from "../model/types";
import { EquipamentosPage } from "./EquipamentosPage.web";

const equipamentos: Equipment[] = [
  { id: "eq-1", name: "Betoneira 400L", description: "Betoneira", pricePerDay: 100, images: [], isAvailable: true, category: { id: "c-1", name: "Concreto" } },
  { id: "eq-2", name: "Andaime tubular", description: "Andaime", pricePerDay: 50, images: [], isAvailable: false, category: { id: "c-2", name: "Altura" } },
];

vi.mock("../model/use-equipment-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../model/use-equipment-catalog")>()),
  useEquipmentCatalog: () => ({
    equipments: equipamentos, categories: [], filteredEquipments: equipamentos, currentEquipments: equipamentos,
    isLoading: false, error: null, searchTerm: "", setSearchTerm: () => {}, categoryFilter: "all", handleCategoryChange: () => {},
    filterKey: 0, currentPage: 1, totalPages: 1, pageKey: 0, changePage: () => {}, fetchData: () => {},
  }),
}));

function renderPage(resolveHref: HrefResolver | null, tenantSlug: string | null) {
  const page = (
    <EquipamentosPage
      categoria={null}
      tenantSlug={tenantSlug}
      image={({ alt }) => <span>{alt}</span>}
      link={({ href, children }) => <a href={href}>{children}</a>}
      filterCard={() => null}
      pagination={() => null}
      categoryBadge={(category) => <span>{category.name}</span>}
    />
  );
  return render(resolveHref ? <HrefResolverProvider resolveHref={resolveHref}>{page}</HrefResolverProvider> : page);
}

const detailHrefs = () => screen.getAllByRole("link").map((link) => link.getAttribute("href"));

beforeAll(() => { MotionGlobalConfig.skipAnimations = true; });
afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
afterEach(() => cleanup());

describe("EquipamentosPage: links do catálogo passam pelo resolvedor do host", () => {
  it("modo host (resolvedor identidade): nenhum href com tenantSlug", () => {
    renderPage((href) => href, "locadora-a");
    expect(detailHrefs()).toEqual(["/equipamentos/eq-1", "/equipamentos/eq-1", "/equipamentos/eq-2"]);
    expect(detailHrefs().some((href) => href?.includes("tenantSlug"))).toBe(false);
  });

  it("modo legado: preserva a locadora pública do resolvedor", () => {
    renderPage((href) => withPublicTenant(href, "locadora-a"), "locadora-a");
    expect(detailHrefs()).toEqual([
      "/equipamentos/eq-1?tenantSlug=locadora-a",
      "/equipamentos/eq-1?tenantSlug=locadora-a",
      "/equipamentos/eq-2?tenantSlug=locadora-a",
    ]);
  });

  it("sem resolvedor na árvore, usa a locadora recebida e não gera ?tenantSlug= vazio", () => {
    renderPage(null, "locadora-b");
    expect(detailHrefs()[0]).toBe("/equipamentos/eq-1?tenantSlug=locadora-b");
    cleanup();
    renderPage(null, null);
    expect(detailHrefs()[0]).toBe("/equipamentos/eq-1");
  });
});
