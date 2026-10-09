import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("InputOTP", () => {
  it("mantém input-otp, border-input e slots no web; nativo sem Tailwind", () => {
    const source = readFileSync(
      new URL("./InputOTP.web.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('from "input-otp"');
    expect(source).toContain("flex items-center gap-2 has-[:disabled]:opacity-50");
    expect(source).toContain(
      "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
    );
    expect(source).toContain("animate-caret-blink bg-foreground");
    const native = readFileSync(
      new URL("../native/InputOTP.native.tsx", import.meta.url),
      "utf8",
    );
    expect(native).toContain("TextInput");
    expect(native).not.toContain("border-input");
    expect(native).not.toContain("className");
    expect(native).not.toContain("gap-2");
  });
});
