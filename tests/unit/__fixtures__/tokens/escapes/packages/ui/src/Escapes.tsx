// Fixture de tools/token-check.mjs: escapes do JavaScript em texto e atributo de JSX, onde o JSX não os interpreta.
declare function toast(message: string): void;

export function Detected() {
  return (
    <section title="Pr\u00f3xima imagem" aria-label="Fechar visualiza\u00e7\u00e3o">
      <h2>Especifica\u00e7\u00f5es T\u00e9cnicas</h2>
      <p data-hint="\u{e7}">A\xe7\xe3o</p>
    </section>
  );
}

// Não contam: strings do JavaScript (interpretadas), o atributo pattern (expressão regular), comentários e texto real.
export function Negatives() {
  toast("Aten\u00e7\u00e3o");
  const label = `per\u00edodo`;
  return (
    <form aria-label={"Pr\u00f3xima"}>
      {/* Especifica\u00e7\u00f5es */}
      <input pattern="[A-Za-z\u00C0-\u00FF ]+" title={label} />
      <p>Especificações Técnicas{"\u00A0"}</p>
    </form>
  );
}
