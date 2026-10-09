import { safeInternalCallback } from "../../../features/entrar";

/** Destino padrão do login da equipe: o índice do painel decide pela sessão (dashboard ou login). */
export const PANEL_HOME = "/admin";

const PANEL_LOGIN = "/admin/login";
const SAME_ORIGIN_PROBE = "http://painel.invalid";

const within = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/**
 * Retorno do login da equipe no host `app`: só caminho interno do painel (`/admin` e `/admin/**`), já normalizado
 * como o navegador faria. Outra origem, área do cliente, a própria entrada `/admin/login` ou um caminho que mudaria
 * numa nova decodificação (o login decodifica o callback outra vez) voltam para `/admin`.
 */
export function resolvePanelCallback(callbackUrl: string | null | undefined): string {
  const safe = safeInternalCallback(callbackUrl);
  if (!safe) return PANEL_HOME;
  let url: URL;
  try {
    url = new URL(safe, SAME_ORIGIN_PROBE);
  } catch {
    return PANEL_HOME;
  }
  const { pathname } = url;
  if (url.origin !== SAME_ORIGIN_PROBE || pathname.includes("%")) return PANEL_HOME;
  if (!within(pathname, PANEL_HOME) || within(pathname, PANEL_LOGIN)) return PANEL_HOME;
  return pathname + url.search + url.hash;
}
