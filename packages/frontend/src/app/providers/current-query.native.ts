/**
 * No app não há URL: o caminho da tela já traz os parâmetros de rota, e o único parâmetro global (`tenantSlug`) volta
 * pelo resolvedor de links do host. Mesmo contrato do web, sem query.
 */
export function readCurrentQuery(_routePath: string): string {
  return "";
}
