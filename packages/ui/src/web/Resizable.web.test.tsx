import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Resizable", () => {
  it("mantém bg-border e Group/Separator no web; nativo sem Tailwind", () => {
    const source = readFileSync(
      new URL("./Resizable.web.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("react-resizable-panels");
    expect(source).toContain(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
    );
    expect(source).toContain("bg-border");
    expect(source).toContain("GripVertical");
    const native = readFileSync(
      new URL("../native/Resizable.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).toContain("flexDirection");
    expect(native).not.toContain("bg-border");
    expect(native).not.toContain("className");
    expect(native).not.toContain("GripVertical");
  });
});
