/**
 * No app não há URL de painel com `?locadora=`: a troca de locadora pelo link universal tem a própria confirmação
 * (Lote 7b). Mesmo contrato do web, sem sugestão.
 */
export const SUGGESTED_TENANT_PARAM = "locadora";

export function readSuggestedTenantSlug(): string | null {
  return null;
}
