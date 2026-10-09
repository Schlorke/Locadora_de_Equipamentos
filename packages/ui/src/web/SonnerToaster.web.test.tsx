// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";
import { Toaster } from "./SonnerToaster.web";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(path.join(here, file), "utf8");

/** O Sonner entrega as toasts ao Toaster num setTimeout. */
async function show(create: () => void) {
  await act(async () => {
    create();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(async () => {
  await act(async () => {
    toast.dismiss();
  });
  cleanup();
});

describe("Toaster", () => {
  it("fica no topo, some em 4 segundos e mantém a configuração do Sonner", () => {
    const source = read("SonnerToaster.web.tsx");
    expect(source).toContain('theme="light"');
    expect(source).toContain('position="top-center"');
    expect(source).toContain("duration={4000}");
    expect(source).toContain("visibleToasts={3}");
    expect(source).toContain("expand={false}");
    expect(source).toContain("closeButton");
    expect(read("../native/SonnerToaster.native.tsx")).not.toContain("120px");
  });

  it("desce 120px no site público e abaixo do header no painel, sem !important", async () => {
    const { container } = render(<Toaster />);
    await show(() => toast("Olá"));
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(/\[data-sonner-toaster\]\s*\{\s*--toaster-top:\s*120px;/);
    expect(css).toMatch(/body\.admin-body-layout \[data-sonner-toaster\]\s*\{\s*--toaster-top:\s*calc\(64px \+ 16px\);/);
    expect(css).toMatch(/@media \(max-width: 767px\)/);
    expect(css).not.toContain("!important");
    const toaster = container.querySelector<HTMLElement>("[data-sonner-toaster]");
    expect(toaster?.style.getPropertyValue("--offset-top")).toBe("var(--toaster-top)");
    expect(toaster?.style.getPropertyValue("--mobile-offset-top")).toBe("var(--toaster-top)");
  });

  it("cada tipo recebe as próprias cores e a toast mantém a altura natural", async () => {
    const { container } = render(<Toaster />);
    await show(() => {
      toast.success("Salvo");
      toast.error("Falhou");
    });
    const success = container.querySelector<HTMLElement>('[data-sonner-toast][data-type="success"]');
    const error = container.querySelector<HTMLElement>('[data-sonner-toast][data-type="error"]');
    expect(success?.className.split(/\s+/)).toEqual(expect.arrayContaining(["bg-green-50", "border-green-100"]));
    expect(error?.className.split(/\s+/)).toEqual(expect.arrayContaining(["bg-red-50", "border-red-100"]));
    // O tipo `default` não entra nas toasts com tipo: não há disputa de cor para resolver com `!`.
    expect(success?.className.split(/\s+/)).not.toContain("bg-white");
    expect(success?.className).not.toMatch(/(^|\s)!|!(\s|$)/);
    expect(success?.style.height).toBe("auto");
    // Transição do botão de fechar contra o CSS do Sonner: regra no <style> do componente, sem modificador `!`.
    const close = success?.querySelector<HTMLElement>("[data-close-button]");
    expect(close?.className).not.toMatch(/(^|\s)!|!(\s|$)/);
    expect(close?.matches("[data-sonner-toast] > [data-close-button]")).toBe(true);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(
      /\[data-sonner-toast\] > \[data-close-button\]\s*\{\s*transition-property: color, background-color, border-color, outline-color,/,
    );
  });
});
