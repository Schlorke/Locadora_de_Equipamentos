/**
 * Serializa um objeto JSON-LD para ser inserido dentro de
 * `<script type="application/ld+json">` via `dangerouslySetInnerHTML`.
 *
 * `JSON.stringify` sozinho NÃO é seguro nesse contexto: um valor como
 * `</script><script>alert(1)</script>` fecha a tag e injeta HTML/JS (XSS).
 * Aqui, depois do `JSON.stringify`, os caracteres perigosos viram escapes
 * Unicode do próprio JSON:
 *
 * - `<` e `>`: impedem `</script>`, `<script>` e `<!--` dentro do bloco;
 * - `&`: defesa em profundidade para contextos que decodificam entidades
 *   (XHTML, atributos) caso o texto seja reaproveitado fora do `<script>`;
 * - U+2028 e U+2029: terminadores de linha que quebram contextos JavaScript.
 *
 * Fora de strings, o JSON não tem nenhum desses caracteres; dentro delas, o
 * escape Unicode decodifica para o mesmo valor. Portanto `JSON.parse` do
 * resultado devolve exatamente os mesmos dados, e dados sem esses caracteres
 * saem byte a byte iguais a `JSON.stringify(data, null, space)`.
 */

// U+2028 e U+2029 escritos como `\u{...}` (flag `u`) para que o próprio fonte
// não contenha terminadores de linha literais.
const UNSAFE_IN_SCRIPT = /[<>&\u{2028}\u{2029}]/gu;

function toUnicodeEscape(char: string): string {
  return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

export function serializeJsonLd(data: object, space?: number): string {
  const json: string | undefined = JSON.stringify(data, null, space);
  if (json === undefined) {
    throw new TypeError("JSON-LD inválido: o valor não é serializável em JSON.");
  }
  return json.replace(UNSAFE_IN_SCRIPT, toUnicodeEscape);
}
