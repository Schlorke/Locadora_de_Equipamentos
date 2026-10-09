import { themes } from "@gb-locacoes/design-tokens";
import { describe, expect, it } from "vitest";
import { resolveButtonStyle } from "./button";

describe("resolveButtonStyle", () => {
  it("maps the production default variant to the slate token", () => {
    expect(resolveButtonStyle(themes.light, "default", {}).backgroundColor).toBe(themes.light.secondary);
    expect(resolveButtonStyle(themes.light, "default", {}).color).toBe(themes.light.onSecondary);
  });

  it("dims the disabled state", () => {
    expect(resolveButtonStyle(themes.light, "default", { disabled: true }).opacity).toBe(0.5);
    expect(resolveButtonStyle(themes.light, "default", {}).opacity).toBe(1);
  });
});
