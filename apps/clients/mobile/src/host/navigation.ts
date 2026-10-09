import type { Href } from "expo-router";

/**
 * As rotas de src/app espelham as URLs do host web (grupos (public), (auth), (account), (admin),
 * (labs) não entram na URL). Por isso os hrefs do frontend compartilhado chegam ao expo-router sem
 * tradução de caminho; o único desvio necessário é abrir links externos fora do app.
 */
const EXTERNAL_HREF = /^(https?:|mailto:|tel:)/i;

export interface HostRouter {
  push(href: Href): void;
  replace(href: Href): void;
}

export interface HostNavigation {
  push(href: string): Promise<void>;
  replace(href: string): Promise<void>;
}

export function createHostNavigation({
  router,
  openURL,
  resolveHref = (href) => href,
}: {
  router: HostRouter;
  openURL: (url: string) => Promise<unknown>;
  resolveHref?: (href: string) => string;
}): HostNavigation {
  const go = (mode: "push" | "replace") => async (href: string) => {
    if (EXTERNAL_HREF.test(href)) {
      await openURL(href);
      return;
    }
    router[mode](resolveHref(href));
  };
  return { push: go("push"), replace: go("replace") };
}

const PRIVATE_PREFIXES = ["/area-cliente", "/perfil", "/enderecos", "/historico"];

/**
 * Rotas que exigem sessão e locadora selecionada antes de renderizar. /admin (entrada, fora do
 * prefixo "/admin/") e /admin/login ficam de fora porque decidem o próprio destino pela sessão do
 * runtime.
 */
export function isPrivateAreaPath(pathname: string): boolean {
  if (pathname === "/admin/login") return false;
  if (pathname.startsWith("/admin/")) return true;
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}
