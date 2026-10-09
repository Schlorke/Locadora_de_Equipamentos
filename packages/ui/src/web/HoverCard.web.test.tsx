import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HoverCard", () => {
  it("mantém Content com bg-popover e animações no web; nativo sem Tailwind", () => {
    const source = readFileSync(new URL("./HoverCard.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("@radix-ui/react-hover-card");
    expect(source).toContain("HoverCardPrimitive.Root");
    expect(source).toContain(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
    );
    expect(source).toContain("data-[state=open]:animate-in");
    const native = readFileSync(new URL("../native/HoverCard.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("Pressable");
    expect(native).not.toContain("bg-popover");
    expect(native).not.toContain("className");
    expect(native).not.toContain("data-[state=");
  });
});
