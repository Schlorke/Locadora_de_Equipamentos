// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./serialize-json-ld";

const XSS = "</script><script>alert(1)</script>";
// U+2028/U+2029 montados em tempo de execução para o fonte não conter terminadores de linha literais.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const unicodeEscape = (hex: string): string => `\\u${hex}`;

/** Monta a página como o navegador a recebe e a interpreta com um parser HTML real. */
function parsePage(jsonLd: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head><script type="application/ld+json">${jsonLd}</script></head>` +
      `<body><p id="depois">conteúdo da página</p></body></html>`,
    "text/html",
  );
}

describe("serializeJsonLd", () => {
  it("neutraliza </script><script> em um valor", () => {
    const data = { "@type": "Product", name: `Betoneira ${XSS}` };

    const json = serializeJsonLd(data);

    const lt = unicodeEscape("003c");
    const gt = unicodeEscape("003e");
    expect(json).not.toMatch(/[<>]/);
    expect(json).toContain(`Betoneira ${lt}/script${gt}${lt}script${gt}alert(1)${lt}/script${gt}`);
    expect(JSON.parse(json)).toEqual(data);
  });

  it.each([
    ["fechamento de script", XSS],
    ["fechamento em maiúsculas", "</SCRIPT ><img src=x onerror=alert(1)>"],
    ["comentário que engole o resto da página", "<!--<script>"],
  ])("mantém o payload inerte dentro de um único <script> (%s)", (_caso, payload) => {
    const data = { "@type": "BreadcrumbList", itemListElement: [{ name: payload }] };

    const doc = parsePage(serializeJsonLd(data, 2));

    expect(doc.scripts).toHaveLength(1);
    expect(doc.querySelectorAll("img")).toHaveLength(0);
    expect(doc.getElementById("depois")?.textContent).toBe("conteúdo da página");
    expect(JSON.parse(doc.scripts[0]!.textContent ?? "")).toEqual(data);
  });

  it("escapa &, U+2028 e U+2029 como escapes Unicode do JSON", () => {
    const data = { hasMap: "https://maps.example/?q=1&hl=pt-BR", nota: `a${LINE_SEPARATOR}b${PARAGRAPH_SEPARATOR}c` };

    const json = serializeJsonLd(data);

    expect(json).not.toContain("&");
    expect(json).not.toContain(LINE_SEPARATOR);
    expect(json).not.toContain(PARAGRAPH_SEPARATOR);
    expect(json).toContain(`q=1${unicodeEscape("0026")}hl=pt-BR`);
    expect(json).toContain(`a${unicodeEscape("2028")}b${unicodeEscape("2029")}c`);
    expect(JSON.parse(json)).toEqual(data);
  });

  it("escapa também as chaves", () => {
    const data = { "<b>": ">" };

    const json = serializeJsonLd(data);

    expect(json).toBe(`{"${unicodeEscape("003c")}b${unicodeEscape("003e")}":"${unicodeEscape("003e")}"}`);
    expect(JSON.parse(json)).toEqual(data);
  });

  it("mantém byte a byte a saída do JSON.stringify quando não há caractere perigoso", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "GB Locações",
      geo: { latitude: -29.99, longitude: -51.19 },
      sameAs: ["https://www.instagram.com/exemplo/"],
      aberto: true,
      nota: null,
    };

    expect(serializeJsonLd(data)).toBe(JSON.stringify(data));
    expect(serializeJsonLd(data, 2)).toBe(JSON.stringify(data, null, 2));
  });

  it("recusa valor que o JSON.stringify não serializa", () => {
    expect(() => serializeJsonLd({ toJSON: () => undefined })).toThrow(TypeError);
  });
});
