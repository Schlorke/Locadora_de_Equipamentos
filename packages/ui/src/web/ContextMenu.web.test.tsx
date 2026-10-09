import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ContextMenu", () => {
  it("mantém Radix, bg-popover e bg-border no web; nativo sem Tailwind", () => {
    const source = readFileSync(
      new URL("./ContextMenu.web.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("@radix-ui/react-context-menu");
    expect(source).toContain("bg-popover p-1 text-popover-foreground");
    expect(source).toContain("bg-border");
    expect(source).toContain("text-foreground");
    const native = readFileSync(
      new URL("../native/ContextMenu.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).toContain("Pressable");
    expect(native).toContain("onLongPress");
    expect(native).not.toContain("bg-popover");
    expect(native).not.toContain("bg-border");
    expect(native).not.toContain("className");
  });
});
