// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", async () => {
  const React = await import("react");
  const View = React.forwardRef(({ children }: { children?: ReactNode }, _ref) => <div>{children}</div>);
  const Text = ({ children }: { children?: ReactNode }) => <span>{children}</span>;
  return { View, Text, ScrollView: View, ActivityIndicator: () => <span>carregando</span> };
});
vi.mock("@gb-locacoes/ui", () => ({
  Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  useTheme: () => ({}),
}));

import { ApiClientProvider, type HttpClient } from "../../../shared/api";
import { HrefResolverProvider } from "../../../shared/lib/navigation";
import { EquipamentosPage } from "./EquipamentosPage.native";

const equipment = {
  id: "eq 1",
  name: "Betoneira",
  description: "400 L",
  pricePerDay: 90,
  images: [],
  category: { id: "cat-1", name: "Concreto" },
  isAvailable: true,
  reviews: [],
};
const apiClient = {
  request: async (path: string) => (path.startsWith("/api/equipments") ? [equipment] : [{ id: "cat-1", name: "Concreto", slug: "concreto" }]),
} as unknown as HttpClient;

async function renderedHrefs(resolveHref?: (_href: string) => string) {
  const page = (
    <ApiClientProvider client={apiClient}>
      <EquipamentosPage
        categoria={null}
        tenantSlug="acme"
        image={() => null}
        link={({ href, children }) => <a href={href}>{children}</a>}
        filterCard={() => null}
        pagination={() => null}
        categoryBadge={() => null}
      />
    </ApiClientProvider>
  );
  render(resolveHref ? <HrefResolverProvider resolveHref={resolveHref}>{page}</HrefResolverProvider> : page);
  await screen.findByText("Betoneira");
  return screen.getAllByRole("link").map((link) => link.getAttribute("href"));
}

afterEach(cleanup);

describe("EquipamentosPage (native) links", () => {
  it("uses the host resolver: host mode keeps the clean path", async () => {
    expect(await renderedHrefs((href) => href)).toEqual(["/equipamentos/eq%201", "/equipamentos/eq%201"]);
  });

  it("uses the host resolver in legacy mode as well", async () => {
    const legacy = vi.fn((href: string) => `${href}?tenantSlug=host-slug`);
    expect(await renderedHrefs(legacy)).toEqual([
      "/equipamentos/eq%201?tenantSlug=host-slug",
      "/equipamentos/eq%201?tenantSlug=host-slug",
    ]);
    expect(legacy).toHaveBeenCalledWith("/equipamentos/eq%201");
  });

  it("without a resolver keeps the page tenant, like the web page", async () => {
    expect(await renderedHrefs()).toEqual(["/equipamentos/eq%201?tenantSlug=acme", "/equipamentos/eq%201?tenantSlug=acme"]);
  });
});
