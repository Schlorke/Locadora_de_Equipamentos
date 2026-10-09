/**
 * Query da URL do navegador (`"?a=1"`, ou `""`), só quando a URL é a da rota informada (`routePath`, caminho visível).
 *
 * A URL do navegador já é a visível: o rewrite do host de locadora para `/{slug}` é interno. É lida na hora do uso
 * (ex.: no clique): ler a query na renderização pediria `useSearchParams` e um limite de Suspense acima dos providers.
 */
export function readCurrentQuery(routePath: string): string {
  if (typeof window === "undefined") return "";
  const { pathname, search } = window.location;
  return pathname === routePath ? search : "";
}
