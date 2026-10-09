import { describe, expect, it } from "vitest";
import { CONTROL_SHADOWS, cn } from "./cn";

describe("cn", () => {
  it("reconhece as sombras dos controles como box-shadow: só a última fica", () => {
    for (const name of CONTROL_SHADOWS) {
      expect(cn("shadow-md", `shadow-${name}`)).toBe(`shadow-${name}`);
      expect(cn(`shadow-${name}`, "shadow-sm")).toBe("shadow-sm");
      expect(cn(`hover:shadow-${name}`, "hover:shadow-lg")).toBe("hover:shadow-lg");
    }
  });

  it("resolve cores e demais conflitos como o tailwind-merge", () => {
    expect(cn("border-input", "border-field")).toBe("border-field");
    expect(cn("px-2", false, "px-4")).toBe("px-4");
  });
});
