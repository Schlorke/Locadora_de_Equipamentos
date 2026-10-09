import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sidebar", () => {
  it("mantém cookie sidebar:state e bg-sidebar no web; native sem Tailwind sidebar", () => {
    const source = readFileSync(new URL("./Sidebar.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("sidebar:state");
    expect(source).toContain("bg-sidebar");
    expect(source).toContain("Toggle Sidebar");
    expect(source).not.toContain("packages/frontend");
    const native = readFileSync(new URL("../native/Sidebar.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("bg-sidebar");
    expect(native).not.toContain("className");
    expect(native).toContain("useSidebar");
  });
});
