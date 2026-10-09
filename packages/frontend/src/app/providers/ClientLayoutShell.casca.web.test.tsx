// @vitest-environment jsdom
// Moldura do ClientLayoutShell escolhida pelo host (`chrome`). A vitrine (padrão) continua com cabeçalho, rodapé,
// WhatsApp, `publicExtras` e a reserva de altura do cabeçalho fixo fora de /admin; a casca da plataforma (fluxos de
// conta no host `app`) não monta nada da vitrine e mostra o nome provisório da plataforma.
import { cleanup, render, screen } from "@testing-library/react";
import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/login" }));
vi.mock("../../shared/lib/navigation/use-visible-pathname.web", () => ({ useVisiblePathname: () => route.pathname }));
vi.mock("../../widgets/cabecalho", () => ({ Header: () => <div data-testid="vitrine-cabecalho" /> }));
vi.mock("../../widgets/rodape", () => ({ default: () => <div data-testid="vitrine-rodape" /> }));
vi.mock("../../widgets/whatsapp-flutuante", () => ({ default: () => <div data-testid="vitrine-whatsapp" /> }));

import { ClientLayoutShell, type ClientLayoutShellProps } from "./ClientLayoutShell.web";

const HEADER_OFFSET = "pt-[calc(env(safe-area-inset-top,0px)+var(--header-offset))]";
const STOREFRONT = ["vitrine-cabecalho", "vitrine-rodape", "vitrine-whatsapp", "extras-publicos"];

function open(pathname: string, chrome?: ClientLayoutShellProps["chrome"]) {
  route.pathname = pathname;
  const view = render(
    <ClientLayoutShell chrome={chrome} publicExtras={<div data-testid="extras-publicos" />}>
      <p>Conteúdo da rota</p>
    </ClientLayoutShell>
  );
  const present = STOREFRONT.filter((id) => screen.queryByTestId(id));
  const offset = view.container.querySelector(".min-h-screen")?.className.includes(HEADER_OFFSET) ?? false;
  return { present, offset };
}

afterEach(cleanup);

describe("moldura do ClientLayoutShell", () => {
  it("vitrine (padrão), fora de /admin: cabeçalho, rodapé, WhatsApp, extras e a reserva do cabeçalho fixo", () => {
    expect(open("/login")).toEqual({ present: STOREFRONT, offset: true });
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.getByText("Conteúdo da rota")).toBeTruthy();
  });

  it("vitrine (padrão) em /admin: nenhuma moldura, como antes", () => {
    expect(open("/admin/dashboard")).toEqual({ present: [], offset: false });
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it.each(["/login", "/recuperar-senha", "/reset-password", "/admin/login"])(
    "casca da plataforma em %s: nada da vitrine; barra com o nome provisório e a rota no conteúdo principal",
    (pathname) => {
      expect(open(pathname, "platform")).toEqual({ present: [], offset: false });
      expect(screen.getByRole("banner").textContent).toBe(PLATFORM.displayName);
      expect(screen.getByRole("main").textContent).toBe("Conteúdo da rota");
    }
  );

  // Achado 142: a pausa da vitrine traz a própria moldura neutra; o shell não monta cabeçalho, rodapé, WhatsApp,
  // extras públicos nem a reserva do cabeçalho fixo, em qualquer caminho visível que o proxy reescreveu.
  it.each(["/", "/equipamentos", "/orcamento", "/contato"])("sem moldura em %s: só o conteúdo da página", (pathname) => {
    expect(open(pathname, "none")).toEqual({ present: [], offset: false });
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.getByText("Conteúdo da rota")).toBeTruthy();
  });
});
