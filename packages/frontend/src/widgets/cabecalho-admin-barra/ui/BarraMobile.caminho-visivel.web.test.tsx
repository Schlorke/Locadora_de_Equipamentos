// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InternalRoutePrefixProvider } from "../../../shared/lib/navigation";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => router.pathname }));
vi.mock("./Acoes.web", () => ({ AdminHeaderActions: () => null }));

import AdminMobileHeader from "./BarraMobile.web";

afterEach(cleanup);

describe("AdminMobileHeader: título pelo caminho visível", () => {
  it("ignora o prefixo interno /{slug} do modo host", () => {
    // O slug contém uma palavra de rota; o caminho interno daria "WhatsApp".
    router.pathname = "/whatsapp-sp/admin/settings";
    render(
      <InternalRoutePrefixProvider prefix="/whatsapp-sp">
        <AdminMobileHeader />
      </InternalRoutePrefixProvider>,
    );
    expect(screen.getByText("Configurações")).toBeTruthy();
    expect(screen.queryByText("WhatsApp")).toBeNull();
  });

  it("fora do modo host usa o caminho do roteador", () => {
    router.pathname = "/admin/whatsapp";
    render(<AdminMobileHeader />);
    expect(screen.getByText("WhatsApp")).toBeTruthy();
  });
});
