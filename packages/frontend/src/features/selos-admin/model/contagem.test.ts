import { describe, expect, it } from "vitest";
import {
  ADMIN_AGING_URL,
  ADMIN_BADGES_INVALIDATE_EVENT,
  ADMIN_BADGES_POLLING_MS,
  ADMIN_BADGE_URL,
  mergeAdminBadgePayloads,
  sumAdminBadges,
} from "./contagem";

describe("selos admin", () => {
  it("FINANCIAL só lê o aging e zera o resto", () => {
    expect(ADMIN_BADGE_URL).toBe("/api/admin/badges");
    expect(ADMIN_AGING_URL).toBe("/api/admin/financial/aging");
    expect(ADMIN_BADGES_POLLING_MS).toBe(60000);
    expect(ADMIN_BADGES_INVALIDATE_EVENT).toBe("admin-badges-invalidate");
    expect(
      mergeAdminBadgePayloads({
        role: "FINANCIAL",
        badgesOk: true,
        badgesBody: { email: 9, quotes: 4 },
        agingOk: true,
        agingBody: { severeCount: 4 },
      }),
    ).toEqual({ email: 0, quotes: 0, rentals: 0, whatsapp: 0, financial: 4 });
    expect(
      mergeAdminBadgePayloads({
        role: "FINANCIAL",
        badgesOk: true,
        badgesBody: { email: 9 },
        agingOk: false,
        agingBody: { severeCount: 4 },
      }),
    ).toEqual({ email: 0, quotes: 0, rentals: 0, whatsapp: 0, financial: 0 });
  });

  it("os demais papéis somam badges e sobrescrevem o financeiro com o aging", () => {
    const merged = mergeAdminBadgePayloads({
      role: "ADMIN",
      badgesOk: true,
      badgesBody: { email: 2, quotes: 1, financial: 8 },
      agingOk: true,
      agingBody: { severeCount: 5 },
    });
    expect(merged).toEqual({ email: 2, quotes: 1, rentals: 0, whatsapp: 0, financial: 5 });
    expect(sumAdminBadges(merged)).toBe(8);
    expect(
      mergeAdminBadgePayloads({
        role: "OPERATOR",
        badgesOk: true,
        badgesBody: { email: 1, financial: 3 },
        agingOk: false,
        agingBody: null,
      }).financial,
    ).toBe(3);
  });
});
