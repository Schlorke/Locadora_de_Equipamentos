export { TenantProvider, useTenantContext } from "./model/tenant-context";
export type { TenantContext, TenantSummary, MembershipRole, OrganizationsResponse } from "@gb-locacoes/contracts";

export {PublicTenantProvider,usePublicTenantSlug} from "./model/public-tenant";
export {
  IdentidadePublicaProvider,
  useIdentidadePublica,
  useMarcaDoAcesso,
} from "./model/identidade-publica";
export { copyrightDaLocadora, siglaDaLocadora } from "./model/marca";
export type { IdentidadePublica } from "./model/marca";

export {withPublicTenant} from './model/public-navigation';
