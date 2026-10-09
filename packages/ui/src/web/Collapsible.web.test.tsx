import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Collapsible", () => {
  it("reexporta Root/Trigger/Content do Radix no web sem Tailwind no nativo", () => {
    const source = readFileSync(new URL("./Collapsible.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('@radix-ui/react-collapsible');
    expect(source).toContain("CollapsiblePrimitive.Root");
    expect(source).toContain("CollapsiblePrimitive.CollapsibleTrigger");
    expect(source).toContain("CollapsiblePrimitive.CollapsibleContent");
    expect(source).toContain("const Collapsible = CollapsiblePrimitive.Root;");
    expect(source).toContain("const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;");
    // O gatilho aplica a moldura de gatilho aberto (trigger.ts); nenhuma outra classe no web.
    expect(source).toContain("className={cn(TRIGGER_FRAME, className)}");
    expect(source.replace("className={cn(TRIGGER_FRAME, className)}", "").match(/className=/g)).toBeNull();
    const native = readFileSync(new URL("../native/Collapsible.native.tsx", import.meta.url), "utf8");
    expect(native).toContain("Pressable");
    expect(native).not.toContain("className");
    expect(native).not.toContain("data-[state=");
  });
});
