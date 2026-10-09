// Fixture de tools/token-check.mjs: a regra jsx-text-escape vale só no escopo do produto, não na raiz legada.
export function Legado() {
  return <p title="Pr\u00f3xima">Especifica\u00e7\u00f5es</p>;
}
