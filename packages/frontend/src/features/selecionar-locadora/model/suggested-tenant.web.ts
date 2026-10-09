/**
 * Sugestão de locadora na URL do painel (`app.<raiz>/admin?locadora={slug}`, ADR adr-tenant-hosts D8): o host da
 * locadora redireciona `/admin` para o app com o slug. É só sugestão: nunca seleciona sem confirmação.
 */
export const SUGGESTED_TENANT_PARAM = "locadora";

export function readSuggestedTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(SUGGESTED_TENANT_PARAM)?.trim();
  return value ? value : null;
}
