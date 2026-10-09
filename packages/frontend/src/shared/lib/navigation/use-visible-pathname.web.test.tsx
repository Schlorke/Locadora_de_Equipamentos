// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InternalRoutePrefixProvider, internalRoutePrefixOf, toVisiblePathname } from "./visible-pathname";
import { useVisiblePathname } from "./use-visible-pathname.web";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => router.pathname }));

afterEach(() => {
  cleanup();
  router.pathname = "/";
  document.body.innerHTML = "";
});

describe("toVisiblePathname", () => {
  it.each([
    ["/locadora-a", "/locadora-a", "/"],
    ["/locadora-a/", "/locadora-a", "/"],
    ["/locadora-a/equipamentos", "/locadora-a", "/equipamentos"],
    ["/locadora-a/equipamentos/eq-1", "/locadora-a", "/equipamentos/eq-1"],
    ["/locadora-a/area-cliente/historico", "/locadora-a", "/area-cliente/historico"],
    // Caminho já visível (navegador): não muda.
    ["/", "/locadora-a", "/"],
    ["/equipamentos", "/locadora-a", "/equipamentos"],
    // Só remove o segmento inteiro, nunca um prefixo parcial do rótulo.
    ["/locadora-ab/equipamentos", "/locadora-a", "/locadora-ab/equipamentos"],
    // Fora do modo host não há prefixo.
    ["/equipamentos", null, "/equipamentos"],
    ["/locadora-a/equipamentos", null, "/locadora-a/equipamentos"],
  ])("%s com prefixo %s → %s", (pathname, prefix, expected) => {
    expect(toVisiblePathname(pathname, prefix)).toBe(expected);
  });

  it("monta o prefixo a partir do slug do host", () => {
    expect(internalRoutePrefixOf("locadora-a")).toBe("/locadora-a");
    expect(internalRoutePrefixOf(null)).toBeNull();
    expect(internalRoutePrefixOf("")).toBeNull();
  });
});

describe("useVisiblePathname", () => {
  it("sem prefixo na árvore devolve o caminho do roteador", () => {
    router.pathname = "/area-cliente";
    const { result } = renderHook(() => useVisiblePathname());
    expect(result.current).toBe("/area-cliente");
  });

  it("no modo host remove o prefixo interno do caminho", () => {
    router.pathname = "/locadora-a/area-cliente";
    const { result } = renderHook(() => useVisiblePathname(), {
      wrapper: ({ children }) => <InternalRoutePrefixProvider prefix="/locadora-a">{children}</InternalRoutePrefixProvider>,
    });
    expect(result.current).toBe("/area-cliente");
  });

  it("servidor (caminho interno) e navegador (caminho visível) produzem o mesmo HTML: hidrata sem divergência", async () => {
    function Breadcrumb() {
      const pathname = useVisiblePathname();
      return <a href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>{pathname}</a>;
    }
    const tree = (
      <InternalRoutePrefixProvider prefix="/locadora-a">
        <Breadcrumb />
      </InternalRoutePrefixProvider>
    );

    router.pathname = "/locadora-a/equipamentos/eq-1";
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/login?callbackUrl=%2Fequipamentos%2Feq-1");

    router.pathname = "/equipamentos/eq-1";
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError }); });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector("a")?.textContent).toBe("/equipamentos/eq-1");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/login?callbackUrl=%2Fequipamentos%2Feq-1");
    act(() => root?.unmount());
  });
});
