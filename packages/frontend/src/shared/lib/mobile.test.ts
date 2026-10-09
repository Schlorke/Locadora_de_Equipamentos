import { describe, expect, it } from "vitest";
import { MOBILE_BREAKPOINT, mobileMediaQuery } from "./mobile";

describe("breakpoint móvel", () => {
  it("trata largura abaixo de 768 como móvel", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
    expect(mobileMediaQuery()).toBe("(max-width: 767px)");
  });
});
