/** Entry universal — sem reexport de módulos `.web`. */
export { AppProviders } from "./providers/AppProviders";
export { PrivateAreaGate } from "./providers/RuntimeBootstrap";
export { usePublicTenantRouting } from "./providers/public-tenant-routing";
export type { PublicTenantRouting, PublicTenantRoutingOptions, LegacyPublicTenantRoutingOptions, HostPublicTenantRoutingOptions, PublicTenantStorage } from "./providers/public-tenant-routing";
export { SEOSchemas, defaultFAQItems } from "../widgets/seo-schemas";

export { createHttpClient } from "../shared/api/http-client";
export type { HttpClient } from "../shared/api/http-client";

export { TenantProvider, useTenantContext } from "../entities/organizacao";
export type { TenantContext, TenantSummary, MembershipRole } from "../entities/organizacao";

export type {DeviceActions,PickedTextFile} from "../shared/device";
