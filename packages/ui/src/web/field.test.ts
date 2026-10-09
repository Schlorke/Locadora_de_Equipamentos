// Molduras dos campos: o estado de erro é declarado na moldura (aria-invalid) com a borda e o halo de erro dos tokens.
// A moldura entra depois do className do consumidor, então uma borda de erro solta (border-red-500) era apagada e a
// validação nunca pintava o campo de vermelho; o erro vem do atributo aria-invalid, não de uma classe do consumidor.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CurrencyInput } from "./CurrencyInput.web";
import { FIELD_FRAME, FIELD_INVALID, FILTER_FIELD_FRAME, TEXTAREA_FRAME } from "./field";
import { Input } from "./Input.web";
import { Textarea } from "./Textarea.web";

const INVALID = [
  "aria-invalid:border-field-invalid",
  "aria-invalid:focus:border-field-invalid",
  "aria-invalid:focus:shadow-control-invalid-focus",
];

/** Atributos da primeira tag do HTML (input ou textarea). */
const tagOf = (html: string) => {
  const tag = /<(input|textarea)\b[^>]*>/.exec(html)?.[0] ?? "";
  return {
    classes: (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean),
    invalid: /aria-invalid="([^"]*)"/.exec(tag)?.[1] ?? null,
  };
};

describe("molduras dos campos: estado de erro", () => {
  it("as três molduras (campo, filtro e área de texto) terminam com o estado de erro por aria-invalid", () => {
    expect(FIELD_INVALID.split(" ")).toEqual(INVALID);
    for (const [name, frame] of Object.entries({ FIELD_FRAME, FILTER_FIELD_FRAME, TEXTAREA_FRAME }))
      expect(frame.endsWith(` ${FIELD_INVALID}`), name).toBe(true);
  });

  it("Input, CurrencyInput e Textarea com aria-invalid: o atributo chega ao campo e as classes de erro sobrevivem ao cn", () => {
    const rendered = {
      Input: renderToStaticMarkup(createElement(Input, { "aria-invalid": true, placeholder: "E-mail" })),
      "Input filter": renderToStaticMarkup(createElement(Input, { "aria-invalid": true, variant: "filter" })),
      "Input number": renderToStaticMarkup(createElement(Input, { "aria-invalid": true, type: "number" })),
      CurrencyInput: renderToStaticMarkup(createElement(CurrencyInput, { "aria-invalid": true, value: 10 })),
      Textarea: renderToStaticMarkup(createElement(Textarea, { "aria-invalid": true })),
    };
    for (const [name, html] of Object.entries(rendered)) {
      const tag = tagOf(html);
      expect(tag.invalid, name).toBe("true");
      expect(tag.classes, name).toEqual(expect.arrayContaining(INVALID));
    }
  });

  it("uma borda de erro solta do consumidor é apagada pela moldura: por isso o erro é o atributo, não a classe", () => {
    const tag = tagOf(renderToStaticMarkup(createElement(Input, { className: "border-red-500 focus:border-green-500" })));
    expect(tag.classes).toContain("border-field");
    expect(tag.classes).not.toContain("border-red-500");
    expect(tag.classes).not.toContain("focus:border-green-500");
    expect(tag.invalid).toBeNull();
  });
});
