export type AdminSessionStatus = "authenticated" | "unauthenticated" | "loading";

/** Destino de /admin. loading não redireciona. */
export function resolveAdminIndexRedirect(status: AdminSessionStatus, hasSession: boolean): string | null {
  if (status === "authenticated" && hasSession) return "/admin/dashboard";
  if (status === "unauthenticated") return "/admin/login";
  return null;
}

export const ADMIN_LOGIN_REDIRECT = "/login";

/**
 * Destino de /admin/login: o login universal, que por sua vez decide pela sessão existente.
 * loading não redireciona, para não navegar antes de a sessão do runtime ser conhecida.
 */
export function resolveAdminLoginRedirect(status: AdminSessionStatus): string | null {
  return status === "loading" ? null : ADMIN_LOGIN_REDIRECT;
}

/** Rota do painel que o papel FINANCIAL abre (o resto do painel o leva para cá). */
export const ADMIN_FINANCIAL_HOME = "/admin/financeiro";
/** Configurações do painel: só o ADMIN do vínculo abre. */
const ADMIN_SETTINGS = "/admin/settings";
/** Entradas públicas do painel (login e entrada da equipe), fora da área privada. */
const PUBLIC_ADMIN_ENTRIES = ["/admin/login", "/admin/entrada"];

/** O caminho é o segmento `prefix` ou fica abaixo dele (`/admin/financeiros` não é `/admin/financeiro`). */
const within = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/**
 * Destino de uma rota do painel pelo papel do vínculo com a locadora selecionada (onda 135, A6), como o layout do
 * painel da raiz legada decidia: FINANCIAL só abre o financeiro (qualquer outra rota do painel o leva a
 * `/admin/financeiro`) e as configurações só abrem para ADMIN (os outros papéis voltam a `/admin`). O papel é o do
 * vínculo (`session.user.role` do runtime, `TenantContext.role`), nunca o `User.role` global; sem papel (sem locadora
 * selecionada), nas entradas públicas e fora do painel: nada. A API continua exigindo a permissão de cada rota.
 */
export function resolveAdminRoleRedirect(pathname: string, role: string | null | undefined): string | null {
  if (!role || !within(pathname, "/admin")) return null;
  if (PUBLIC_ADMIN_ENTRIES.some((entry) => within(pathname, entry))) return null;
  if (role === "FINANCIAL") return within(pathname, ADMIN_FINANCIAL_HOME) ? null : ADMIN_FINANCIAL_HOME;
  if (role !== "ADMIN" && within(pathname, ADMIN_SETTINGS)) return "/admin";
  return null;
}
