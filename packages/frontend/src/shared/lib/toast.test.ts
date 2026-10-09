import { describe, expect, it } from "vitest";
import { toast, useSonner } from "./toast.web";
import { toast as sonnerToast, useSonner as sonnerHook } from "sonner";
describe("web toast compatibility", () => {
  it("preserves the existing Sonner instance and hook", () => { expect(toast).toBe(sonnerToast); expect(useSonner).toBe(sonnerHook); });
});
