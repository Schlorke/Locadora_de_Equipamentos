export const TENANT_HEADER_NAME = "x-tenant-id";
export const TENANT_COOKIE_NAME = "selected-tenant-id";

export type MembershipRole = "ADMIN" | "FINANCIAL" | "OPERATOR" | "CLIENT";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";
export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
}
export interface TenantContext {
  tenant: TenantSummary;
  membershipId: string;
  role: MembershipRole;
}
export interface OrganizationsResponse {
  memberships: TenantContext[];
}
