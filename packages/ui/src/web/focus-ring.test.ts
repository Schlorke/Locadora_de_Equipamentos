// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { FOCUS_RING, MENU_FOCUS_RING, trackInputModality } from "./focus-ring";

const modality = () => document.documentElement.getAttribute("data-input-modality");
const key = (init: ConstructorParameters<typeof KeyboardEvent>[1]) => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));

describe("focus-ring", () => {
  afterEach(() => document.documentElement.removeAttribute("data-input-modality"));

  it("anel de 2px com o token --focus-ring só em :focus-visible; nos menus, só com modalidade de teclado e sem contorno fora dela, nem nas cores forçadas", () => {
    expect(FOCUS_RING.split(" ")).toEqual([
      "focus-visible:outline-solid",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-focus-ring",
    ]);
    // outline-hidden desliga o anel do navegador; nas cores forçadas ele grava um sólido transparente que o sistema
    // pinta (em repouso e no clique), e forced-colors:outline-0 zera a largura. O anel de teclado volta a 2px.
    // Prova de estilo por elemento, contra a produção e nas cores forçadas: tests/visual/tailwind-parity.test.ts.
    expect(MENU_FOCUS_RING.split(" ")).toEqual([
      "outline-hidden",
      "forced-colors:outline-0",
      ...FOCUS_RING.split(" ").map((c) => `in-data-[input-modality=keyboard]:${c}`),
    ]);
  });

  it("nenhum anel de foco próprio fora do token: o código web não pinta anel, contorno ou borda laranja em :focus, :focus-visible ou :focus-within", () => {
    // Decisão do usuário (onda 5): foco por teclado no laranja da marca (#ea580c, --focus-ring), por FOCUS_RING ou
    // MENU_FOCUS_RING, nunca no clique. Um laranja próprio no foco é outro tom (orange-500) e, na variante focus:,
    // aparece também no clique do mouse. Os anéis semânticos (verde do WhatsApp, vermelho de erro) não são o anel da
    // marca e ficam. Vale com variantes encadeadas (md:focus:…, group-focus:…) e com o modificador ! de prioridade.
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
    const files = ["packages/ui/src", "packages/frontend/src", "apps/clients/web/src"].flatMap((dir) =>
      (readdirSync(path.join(root, dir), { recursive: true }) as string[])
        .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\./.test(file))
        .map((file) => path.join(root, dir, file)),
    );
    expect(files.length).toBeGreaterThan(700);
    const OWN_FOCUS_ORANGE = /(?<![\w-])(?:[\w[\]=&-]+:)*(?:group-|peer-)?focus(?:-visible|-within)?:(?:[\w[\]=&-]+:)*!?(?:ring|outline|border)(?:-[xytrblse])?-orange-\d{2,3}\b/g;
    const hits = files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(OWN_FOCUS_ORANGE)].map((m) => `${path.relative(root, file).split(path.sep).join("/")}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
    // A expressão pega as formas que já existiram no código (onda 5 e o gatilho do intervalo de datas).
    const caught = (text: string) => [...text.matchAll(OWN_FOCUS_ORANGE)].map((m) => m[0]);
    expect(caught("focus-visible:ring-orange-500 x focus-visible:outline-orange-500")).toHaveLength(2);
    expect(caught("'hover:bg-gray-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500'")).toEqual(["focus:border-orange-500", "focus:ring-orange-500"]);
    expect(caught("md:focus-within:!ring-orange-600 group-focus:outline-orange-400")).toHaveLength(2);
    expect(caught("hover:ring-orange-500 data-[state=on]:border-orange-500 focus-visible:ring-green-500 focus:border-field-focus")).toEqual([]);
  });

  it("registra teclado depois de uma tecla e ponteiro depois de mouse, toque ou caneta", () => {
    trackInputModality();
    trackInputModality(); // instalado uma vez só
    expect(modality()).toBeNull();

    key({ key: "Tab" });
    expect(modality()).toBe("keyboard");

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(modality()).toBe("pointer");

    // Atalhos com Ctrl, Alt ou Meta não são navegação por teclado.
    key({ key: "c", ctrlKey: true });
    key({ key: "Tab", altKey: true });
    key({ key: "r", metaKey: true });
    expect(modality()).toBe("pointer");

    key({ key: "ArrowDown" });
    expect(modality()).toBe("keyboard");
  });
});
