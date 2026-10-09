export const ADMIN_BADGE_URL = "/api/admin/badges";
export const ADMIN_AGING_URL = "/api/admin/financial/aging";
export const ADMIN_BADGES_POLLING_MS = 60000;
export const ADMIN_BADGES_INVALIDATE_EVENT = "admin-badges-invalidate";

export interface AdminBadges {
  email: number;
  quotes: number;
  rentals: number;
  whatsapp: number;
  financial: number;
}

export const DEFAULT_ADMIN_BADGES: AdminBadges = {
  email: 0,
  quotes: 0,
  rentals: 0,
  whatsapp: 0,
  financial: 0,
};

export function invalidateAdminBadges(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_BADGES_INVALIDATE_EVENT));
}

export function sumAdminBadges(badges: AdminBadges): number {
  return badges.email + badges.quotes + badges.rentals + badges.whatsapp + badges.financial;
}

function severeCountOf(body: unknown): number {
  const record = body as { severeCount?: number };
  return record.severeCount ?? 0;
}

export function mergeAdminBadgePayloads(input: {
  role: string | undefined;
  badgesOk: boolean;
  badgesBody: unknown;
  agingOk: boolean;
  agingBody: unknown;
}): AdminBadges {
  if (input.role === "FINANCIAL") {
    if (!input.agingOk) return { ...DEFAULT_ADMIN_BADGES };
    return { ...DEFAULT_ADMIN_BADGES, financial: severeCountOf(input.agingBody) };
  }

  let badges: AdminBadges = { ...DEFAULT_ADMIN_BADGES };
  if (input.badgesOk) {
    badges = { ...badges, ...(input.badgesBody as Partial<AdminBadges>) };
  }
  if (input.agingOk) {
    badges.financial = severeCountOf(input.agingBody);
  }
  return badges;
}
