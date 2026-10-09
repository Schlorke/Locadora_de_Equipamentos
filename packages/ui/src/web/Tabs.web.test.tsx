// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs.web";

const here = path.dirname(fileURLToPath(import.meta.url));
const RING = [
  "focus-visible:outline-solid",
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
  "focus-visible:outline-focus-ring",
];

describe("Tabs", () => {
  afterEach(cleanup);

  it("aba ativa laranja sem sombra e anel de foco só por teclado (token --focus-ring)", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Primeira</TabsTrigger>
          <TabsTrigger value="b">Segunda</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Conteúdo A</TabsContent>
        <TabsContent value="b">Conteúdo B</TabsContent>
      </Tabs>,
    );
    const ativa = screen.getByRole("tab", { name: "Primeira" });
    const inativa = screen.getByRole("tab", { name: "Segunda" });
    expect(ativa.getAttribute("data-state")).toBe("active");
    expect(inativa.getAttribute("data-state")).toBe("inactive");
    for (const aba of [ativa, inativa]) {
      const classes = aba.className.split(/\s+/);
      expect(classes).toEqual(expect.arrayContaining([...RING, "data-[state=active]:bg-white", "data-[state=active]:text-orange-600", "duration-200"]));
      // Sem sombra nem anel por box-shadow: a aba nunca teve sombra visível (a regra global a zerava).
      expect(classes.some((c) => /(^|:)(shadow|ring)(-|$)/.test(c))).toBe(false);
      // Sem remoção de contorno no foco: o clique do mouse não casa :focus-visible, o teclado mostra o anel.
      expect(classes.some((c) => /^focus(-visible)?:outline-(none|hidden)$/.test(c))).toBe(false);
    }
    expect(screen.getByRole("tablist").className).toContain(
      "inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500",
    );
    // O painel usa o mesmo anel da marca (token --focus-ring), não mais um anel próprio em orange-500.
    const painel = screen.getByRole("tabpanel").className.split(/\s+/);
    expect(painel).toEqual(expect.arrayContaining(["mt-2", ...RING]));
    expect(painel.some((c) => /orange-500|(^|:)ring(-|$)/.test(c))).toBe(false);
  });

  it("nativo sem classes Tailwind do web", () => {
    const native = readFileSync(path.join(here, "../native/Tabs.native.tsx"), "utf8");
    expect(native).not.toContain("text-orange-600");
    expect(native).not.toContain("bg-gray-100");
  });
});
