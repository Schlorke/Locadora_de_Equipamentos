// Plugin do stylelint com as regras de estrutura do CSS do produto (lint:css, .stylelintrc.json):
//   css-structure/max-lines        arquivo de estilo com mais linhas que o limite (300) reprova: divida por
//                                  responsabilidade em vez de crescer um arquivo "monstro";
//   css-structure/no-layer-names   camada proibida de volta (overrides e suas sub-camadas, que empilhavam regras
//                                  legadas depois dos utilitários), em @layer (lista ou bloco) e em @import … layer().
// Testes: tests/unit/stylelint-css-structure.test.ts.
import stylelint from "stylelint";

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

const NAMESPACE = "css-structure";

/** Linhas do arquivo como o editor mostra (a quebra final não abre uma linha nova). */
export function lineCount(text) {
  if (text === "") return 0;
  const lines = text.split(/\r\n|\r|\n/);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

const maxLinesName = `${NAMESPACE}/max-lines`;
const maxLinesMessages = ruleMessages(maxLinesName, {
  tooLong: (lines, max) => `Arquivo com ${lines} linhas (máximo ${max}): divida por responsabilidade`,
});

/** @type {import("stylelint").Rule} */
const maxLines = (max) => (root, result) => {
  const valid = validateOptions(result, maxLinesName, { actual: max, possible: [(value) => Number.isInteger(value) && value > 0] });
  if (!valid) return;
  const lines = lineCount(root.source?.input.css ?? "");
  if (lines <= max) return;
  report({
    ruleName: maxLinesName,
    result,
    node: root,
    message: maxLinesMessages.tooLong(lines, max),
    start: { line: max + 1, column: 1 },
    end: { line: max + 1, column: 2 },
  });
};
maxLines.ruleName = maxLinesName;
maxLines.messages = maxLinesMessages;

const layerName = `${NAMESPACE}/no-layer-names`;
const layerMessages = ruleMessages(layerName, {
  forbidden: (layer) => `Camada "${layer}" proibida: o estilo vive no componente ou nas camadas base/components`,
});

/** Nomes de camada de um prelúdio de @layer ("a, b.c") ou do layer(…) de um @import. */
export function layerNames(atRule) {
  if (atRule.name === "layer") return atRule.params.split(",").map((name) => name.trim()).filter(Boolean);
  if (atRule.name === "import") return [...atRule.params.matchAll(/\blayer\(\s*([^)]*?)\s*\)/g)].map((match) => match[1]);
  return [];
}

/** @type {import("stylelint").Rule} */
const noLayerNames = (forbidden) => (root, result) => {
  const valid = validateOptions(result, layerName, {
    actual: forbidden,
    possible: [(value) => typeof value === "string" && /^[\w-]+$/.test(value)],
  });
  if (!valid) return;
  const names = new Set(forbidden);
  root.walkAtRules(/^(layer|import)$/i, (atRule) => {
    for (const layer of layerNames(atRule)) {
      if (!layer.split(".").some((segment) => names.has(segment))) continue;
      report({ ruleName: layerName, result, node: atRule, message: layerMessages.forbidden(layer), word: layer });
    }
  });
};
noLayerNames.ruleName = layerName;
// A opção é a lista de nomes (["overrides"]), não [opção primária, secundária].
noLayerNames.primaryOptionArray = true;
noLayerNames.messages = layerMessages;

export default [createPlugin(maxLinesName, maxLines), createPlugin(layerName, noLayerNames)];
