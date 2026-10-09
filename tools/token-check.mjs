#!/usr/bin/env node
// Design-token gate. Design values that the design system governs — colors, spacing, radius,
// border widths and typography — may only be defined in the canonical token source; consumer code
// must read them from it. Separate from arch-check.mjs (import direction); CI runs both, and
// tools/ratchet-guard.mjs anchors tools/token-baseline.json to the base branch.
//   node tools/token-check.mjs [--root <product>] [--json]
//   node tools/token-check.mjs --update-baseline   rewrites the ratchet baseline; refuses any increase
//   node tools/token-check.mjs --init-baseline     creates the baseline once; refuses if it exists
//
// Examined: .ts .tsx .js .jsx .mjs .cjs (TypeScript AST: string, template and numeric literals in
// value positions, style objects, JSX attributes, local constants; Tailwind classes inside any
// string) and .css (declarations and `@apply`); .scss .sass .less only for css-important. The
// Tailwind JS config that a stylesheet loads (`@config`, plus the root tailwind.config.*) and the
// local plugins it loads (`@plugin`, or require/import of a relative file in the config) are read
// for css-important wherever they live.
// Not examined (reported as such): every other file type, e.g. .json, .svg, images.
//
// Three kinds of rule:
//   zero tolerance — any occurrence fails in EVERY scope (product, legacy root and canonical source), with no
//     baseline entry and no allow comment or `allow` entry: css-important (described below). The baseline lists it
//     in "rules" with a fixed allowance of zero, so tools/ratchet-guard.mjs still reports its removal; readBaseline
//     refuses any count for it.
//   absolute — any occurrence fails (in the product scope; in the legacy scope every one of these is a ratchet, see
//     legacyScope): color-literal (including Tailwind `bg-[#ea580c]`),
//     named-color, dimension-literal, number-literal, font-weight-literal, local-constant,
//     token-redefinition, custom-property-definition, exception-without-reason, and jsx-text-escape (product scope
//     .tsx/.jsx only): a JavaScript escape (`\u00e7`, `\u{e7}`, `\xe7`) in JSX text or in a JSX attribute string,
//     where JSX never interprets it, so the interface would show the backslash sequence ("Especifica\u00e7\u00f5es");
//     the `pattern` attribute (a regular expression, where the escape is intentional) is the exception.
//   ratchet  — RATCHET_RULES below. The product predates them and holds thousands of occurrences,
//     so tools/token-baseline.json records a count per file and rule. The gate fails when any
//     file exceeds its count or a file absent from the baseline has one; a lower count passes and
//     can be locked in with --update-baseline, which never accepts an increase.
//       tailwind-palette-class  bg-orange-600, hover:text-slate-700, border-gray-200/50, text-white,
//                               every color utility of Tailwind 4.3.3 (drop-shadow-, inset-ring-,
//                               text-shadow-, mask-t-from-, scrollbar-thumb-…) and opacity /7.5, /(--a), also
//                               read through the palette variable: bg-[var(--color-orange-600)],
//                               bg-(--color-orange-600), [color:var(--color-orange-600)] (the same CSS), and
//                               any arbitrary value that reads the palette: a var() fallback, color-mix(),
//                               gradients and shadows with var(--color-…), theme(colors.orange.600) and
//                               --theme(--color-orange-600)
//       arbitrary-color         shadow-[0_0_20px_rgba(249,115,22,0.4)] — a color the absolute rule
//                               never saw, because `_rgba(` has no word boundary
//       arbitrary-dimension     w-[123px], h-[calc(100vh-64px)], [--x:12px]
//       hsl-triple              `--primary: 24.6 95% 53.1%` in CSS or a style object
//       z-index-literal         z-50, -z-10, z-[9999], `z-index: 9999`, `zIndex: 50`
//   The zero-tolerance rule:
//       css-important           `!important` in stylesheets (.css .scss .sass .less, the canonical
//                               source included), in code strings (inline style, CSS-in-JS, <style>)
//                               and `style.setProperty(p, v, "important")`; `@import "tailwindcss"
//                               important`; the Tailwind important modifier `!bg-white`, `bg-white!`,
//                               `hover:!bg-white`, `![position:static]` inside class strings
//                               (className/class attributes, cn/clsx/cva/twMerge/tw… arguments,
//                               *ClassName/*Classes names) or strings made only of Tailwind classes —
//                               never UI text such as "Sucesso!"; the `important` option of a Tailwind
//                               JS config (`important: true` or a selector turns every utility into
//                               `!important`). No exception, not even `@media (prefers-reduced-motion:
//                               reduce)`, and no allow comment applies.
//     Token references pass: bg-primary, w-[var(--sidebar-width)], z-[var(--layer-dialog)],
//     `z-index: var(--layer-dialog)`, `--layer-dialog: 90` (a layer token, not a z-index use).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_TOKEN_CONFIG = {
  canonical: ["packages/design-tokens/src"],
  scope: ["apps/clients/web", "apps/clients/mobile", "packages/ui/src", "packages/frontend/src"],
  // Legacy root with code (arch.config.json legacyRoots, minus the generated token compatibility layer and
  // static browser assets). It is outside the design-system contract, so every rule found there — absolute
  // ones included — is a per-file ratchet: the legacy host cannot grow design values, and a file moved out
  // of packages/frontend into app/ or lib/ is a new file with findings, not a reduction. It lists exactly the
  // legacyRoots with code of arch.config.json (tests/unit/token-check.test.ts holds both in sync): a root the
  // architecture gate retires leaves this list too, so a recreated folder is not legacy for one gate and an
  // unclassified root for the other.
  legacyScope: ["app", "lib", "middlewares", "schemas", "types/global.d.ts", "types/google-maps-ecl.d.ts", "proxy.ts"],
  ignoreDirs: ["node_modules", ".next", ".expo", "dist", "dist-export", "build", "coverage", "android", "ios"],
  // Tests may assert concrete values; adversarial fixtures live in __fixtures__.
  ignoreFiles: ["\\.(test|spec)\\.[cm]?[jt]sx?$", "(^|/)__fixtures__/"],
  allow: [],
  // Ratchet baseline, relative to the product root.
  baseline: "tools/token-baseline.json",
};

/** Rules enforced by the per-file ratchet instead of failing on every occurrence. */
export const RATCHET_RULES = ["tailwind-palette-class", "arbitrary-color", "arbitrary-dimension", "hsl-triple", "z-index-literal"];
/**
 * Rules that fail on every occurrence in every scope (product, legacy root, canonical source): never ratcheted, never
 * counted in the baseline, and no `token-check-allow` comment or `allow` entry exempts them.
 */
export const ZERO_TOLERANCE_RULES = ["css-important"];
const ZERO_TOLERANCE = new Set(ZERO_TOLERANCE_RULES);
/**
 * The baseline "rules": the ratchet rules plus the zero-tolerance ones, whose allowance is fixed at zero. Keeping them
 * listed lets tools/ratchet-guard.mjs report their removal from the file, as it does for a dropped ratchet rule.
 */
export const BASELINE_RULES = [...RATCHET_RULES, ...ZERO_TOLERANCE_RULES];
/** Rules that fail on every occurrence in the product scope; in the legacy scope they are ratcheted too. */
export const ABSOLUTE_RULES = ["color-literal", "named-color", "dimension-literal", "number-literal", "font-weight-literal", "local-constant", "token-redefinition", "custom-property-definition", "exception-without-reason", "jsx-text-escape"];
const ALL_RULES = [...RATCHET_RULES, ...ABSOLUTE_RULES];
const inScope = (rel, entries) => entries.some((entry) => rel === entry || rel.startsWith(`${entry}/`));

const CODE = /\.(tsx?|jsx?|mjs|cjs)$/;
const CSS = /\.css$/;
// Preprocessor stylesheets: examined for css-important only.
const STYLESHEET = /\.(?:scss|sass|less)$/;
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const DIMENSION = /(?<![\w.#-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|pt|dp|vh|vw|vmin|vmax|%)?(?![\w.])/g;
const NAMED = new Set("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" "));
const COLOR_PROP = /(^|[a-z])(color|colour)$|^(background|backgroundColor|borderColor|border(Top|Right|Bottom|Left|Start|End)Color|outlineColor|shadowColor|textShadowColor|tintColor|overlayColor|placeholderTextColor|selectionColor|underlineColorAndroid|fill|stroke|stopColor|floodColor|lightingColor)$/i;
const DIM_PROP = /^(padding|margin)(Top|Right|Bottom|Left|Horizontal|Vertical|Start|End|Block|Inline|BlockStart|BlockEnd|InlineStart|InlineEnd)?$|^(gap|rowGap|columnGap)$|^border(Top|Right|Bottom|Left|Start|End)?(Left|Right)?Radius$|^border(TopLeft|TopRight|BottomLeft|BottomRight|TopStart|TopEnd|BottomStart|BottomEnd)Radius$|^border(Top|Right|Bottom|Left|Start|End)?Width$|^(fontSize|lineHeight|letterSpacing)$/;
const SHORTHAND = /^(border(Top|Right|Bottom|Left)?|padding|margin|font|outline)$/;
const WEIGHT_PROP = /^fontWeight$/;
const ALLOW_COMMENT = /token-check-allow:\s*(.*)$/;
const CSS_KEYWORDS = new Set(["transparent", "currentcolor", "inherit", "initial", "unset", "none", "revert"]);
// Tailwind default palette. Semantic utilities (bg-primary, text-muted-foreground, border-border)
// read CSS variables and are not palette classes. Hues and color utilities are the ones Tailwind 4.3.3
// generates (its design system class list: every `<utility>-orange-600`), which also covers v3.
const PALETTE_HUES = "slate|gray|zinc|neutral|stone|mauve|mist|olive|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITY = [
  "bg", "text", "text-shadow", "border(?:-(?:[xytrblse]|bs|be))?", "outline", "ring(?:-offset)?", "inset-ring",
  "shadow", "inset-shadow", "drop-shadow", "divide", "from", "via", "to", "fill", "stroke", "accent", "caret",
  "decoration", "placeholder", "scrollbar-(?:thumb|track)", "mask-(?:[trblxy]|linear|radial|conic)-(?:from|to)",
].join("|");
// Opacity modifier: /50, /7.5, /[0.3], /(--alpha).
const OPACITY = "\\/(?:\\d+(?:\\.\\d+)?|\\[[^\\]]+\\]|\\([^)]+\\))";
const PALETTE_COLOR = `(?:(?:${PALETTE_HUES})-(?:50|[1-9]00|950)|white|black)`;
const PALETTE_CLASS = new RegExp(`^(?:${COLOR_UTILITY})-${PALETTE_COLOR}(?:${OPACITY})?$`);
// The same palette color read through its variable renders the same CSS (`var(--color-orange-600)`):
// `bg-[var(--color-orange-600)]`, `bg-[color:var(--…)]`, Tailwind 4's `bg-(--color-orange-600)` and
// `bg-(color:--…)`, with any fallback, and an arbitrary property such as `[color:var(--color-orange-600)]`.
const PALETTE_VARIABLE = `--color-${PALETTE_COLOR}`;
const PALETTE_VARIABLE_CLASS = new RegExp(
  `^(?:${COLOR_UTILITY})-(?:\\[(?:color:)?var\\(${PALETTE_VARIABLE}(?:,[^\\]]*)?\\)\\]|\\((?:color:)?${PALETTE_VARIABLE}(?:,.*)?\\))(?:${OPACITY})?$`,
);
const PALETTE_VARIABLE_PROPERTY = new RegExp(`^\\[-{0,2}[a-zA-Z][\\w-]*:var\\(${PALETTE_VARIABLE}(?:,[^\\]]*)?\\)\\]$`);
// Any other arbitrary value that reads the palette renders the palette color too: a `var()` anywhere in it (as a
// fallback, inside color-mix(), a gradient or a shadow; CSS function names ignore case), `--theme(--color-…)`, and
// `theme()` with the variable or the key path (`colors.orange.600`, `colors.orange[600]`, `colors.orange-600`), which
// Tailwind 4.3.3 resolves to the palette value. Tailwind keeps underscores in a var() name and leaves THEME(),
// `--theme(colors.…)` and quoted text alone, so those do not read the palette (tests/unit/token-check.test.ts compiles
// every spelling with the design system and compares).
const PALETTE_NAME = new RegExp(`^${PALETTE_VARIABLE}$`);
const VAR_NAME = /(?<![A-Za-z0-9-])[vV][aA][rR]\((--[\w-]+)(?=[,)])/g;
const THEME_ARGUMENT = /(?<![A-Za-z0-9])(--)?theme\(\s*['"]?([^'"\s/,)]+)/g;
const QUOTED = /(theme\(\s*)?(['"])(?:\\.|(?!\2)[^\\])*\2/g;
const Z_UTILITY = /^-?z-/;
const Z_CLASS = /^-?z-(?:\d+|\[-?\d+\])$/;
const ARBITRARY_VALUE = /^-?[a-z][a-z0-9-]*?-\[(.+)\](?:\/[\w.%[\]-]+)?$/;
const ARBITRARY_PROPERTY = /^\[(-{0,2}[a-zA-Z][\w-]*):(.+)\]$/;
// Lengths only: unitless numbers, percentages, times and angles are not design dimensions here.
const LENGTH = /(?<![\w#.])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|vh|vw|dvh|svh|lvh|vmin|vmax|ch|ex|pt)(?![\w%])/g;
const NUMBER = "(?:\\d+\\.?\\d*|\\.\\d+)";
const HSL_TRIPLE = new RegExp(`^-?${NUMBER}(?:deg|turn|rad|grad)?\\s+-?${NUMBER}%\\s+-?${NUMBER}%(?:\\s*\\/\\s*${NUMBER}%?)?$`);
const Z_LITERAL = /^-?\d+$/;
const IMPORTANT = /\s*!important\s*$/i;

// --- css-important ---
// Roots of every Tailwind 4.3.3 utility (`bg` of bg-white, `mx` of -mx-4) and the utilities without a dash;
// tests/unit/token-check.test.ts proves both lists against the design system's class list. They tell a
// string made of Tailwind classes ("!bg-white px-4") from UI text ("Sucesso!", "copiada!").
export const TAILWIND_ROOTS = new Set("@container accent align animate appearance aspect auto backdrop backface basis bg block blur border bottom box break brightness caption caret clear col columns contain content contrast cursor decoration delay diagonal divide drop duration ease end field fill flex float flow font forced from gap grayscale grid grow h hue hyphens indent inline inset invert isolation items justify leading left line lining list m mask max mb mbe mbs me min mix ml mr ms mt mx my no normal not object oldstyle opacity order origin outline overflow overscroll p pb pbe pbs pe perspective pl place placeholder pointer pr proportional ps pt px py resize right ring rotate rounded row saturate scale scheme scroll scrollbar select self sepia shadow shrink size skew slashed snap space sr stacked start stroke subpixel tab table tabular text to top touch tracking transform transition translate underline via w whitespace will wrap z zoom".split(" "));
export const TAILWIND_STATIC = new Set("@container absolute antialiased block border capitalize collapse container contents fixed flex grayscale grid grow hidden inline invert invisible isolate italic lowercase ordinal outline overline relative resize ring sepia shadow shrink static sticky table transform transition truncate underline uppercase visible".split(" "));
// Functions and names whose strings are class lists.
const CLASS_FUNCTIONS = new Set(["cn", "clsx", "classnames", "classNames", "cx", "cva", "tv", "twMerge", "twJoin", "tw", "ctl"]);
const CLASS_NAME = /^(?:class|className|classNames|classes|\w+ClassNames?|\w+Class(?:es)?)$/;
const CLASS_LIST_CALL = /\.classList\.(?:add|remove|toggle|replace)$/;
// Utility core (the base without `!`): `bg-white`, `-mt-4`, `w-[12px]`, `[position:static]`, `@container`.
const CLASS_CORE = /^-?(?:@?[a-z][a-z0-9]*(?:-[^\s!]+)?|\[[^\s\]]+\](?:\/[^\s!]+)?)$/;
const VARIANT_PREFIX = /^[\w@*&[\]\-/.()=,'"#>~+%:]*$/;
const IMPORTANT_DECLARATION = /!\s*important\b/gi;
const IMPORT_IMPORTANT = /@import\s[^;{}]*?\simportant\s*(?:;|$)/gim;

/** Splits a class token into its variant prefix (`hover:`, `[&_svg]:`) and base, honoring brackets. */
function splitVariants(token) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    const c = token[i];
    if (c === "[" || c === "(") depth += 1;
    else if ((c === "]" || c === ")") && depth > 0) depth -= 1;
    else if (c === ":" && depth === 0) start = i + 1;
  }
  return { variants: token.slice(0, start), base: token.slice(start) };
}

/** Utility core of a class token and whether it carries the important modifier; `null` if not class-shaped. */
function parseClassToken(token) {
  let { variants, base } = splitVariants(token);
  let important = false;
  if (variants.startsWith("!")) {
    important = true;
    variants = variants.slice(1);
  }
  if (base.startsWith("!")) {
    important = true;
    base = base.slice(1);
  }
  if (base.endsWith("!")) {
    important = true;
    base = base.slice(0, -1);
  }
  if (!CLASS_CORE.test(base) || !VARIANT_PREFIX.test(variants)) return null;
  return { core: base, important };
}

/** A Tailwind utility by name: known root (`bg-…`), known single word (`hidden`) or arbitrary property. */
function isTailwindUtility(core) {
  const name = core.replace(/^-/, "");
  if (name.startsWith("[")) return true;
  const dash = name.indexOf("-", name.startsWith("@") ? 1 : 0);
  return dash === -1 ? TAILWIND_STATIC.has(name) || TAILWIND_ROOTS.has(name) : TAILWIND_ROOTS.has(name.slice(0, dash));
}

/**
 * Tailwind important modifiers in a string. In a class context (`classContext`) every class-shaped token with
 * `!` counts; elsewhere the string must consist only of class-shaped tokens and the marked utility must be a
 * Tailwind utility, so UI text such as "Sucesso!" or "Link copiado!" never counts.
 */
export function importantClassFindings(text, { classContext = false } = {}) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.some((token) => token.includes("!"))) return [];
  const parsed = tokens.map((token) => ({ token, parsed: token === "!important" ? null : parseClassToken(token) }));
  if (!classContext && parsed.some((entry) => entry.parsed === null && entry.token !== "!important")) return [];
  return parsed
    .filter(({ parsed: p }) => p?.important && (classContext || isTailwindUtility(p.core)))
    .map(({ token }) => ({ rule: "css-important", value: token }));
}

/** Declaration around `index` for the report: `z-index: 9999 !important`. */
function declarationAt(text, index, end) {
  let start = index;
  while (start > 0 && !"{};\n".includes(text[start - 1])) start -= 1;
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  return snippet.length > 100 ? `…${snippet.slice(-99)}` : snippet;
}

/** `!important` declarations and `@import … important` in stylesheet or CSS-in-JS text, with no exception. */
export function importantDeclarations(text) {
  const found = [];
  for (const m of text.matchAll(IMPORTANT_DECLARATION)) {
    found.push({ index: m.index, value: declarationAt(text, m.index, m.index + m[0].length) });
  }
  for (const m of text.matchAll(IMPORT_IMPORTANT)) {
    if (!/!\s*important\s*;?$/i.test(m[0])) found.push({ index: m.index, value: m[0].replace(/\s+/g, " ").trim() });
  }
  return found.sort((a, b) => a.index - b.index);
}

/**
 * `important` option of a Tailwind JS config: `important: true` (or a selector string, or any value that is not the
 * literal `false`) makes every generated utility `!important`, with no `!important` written anywhere else. It counts
 * in any top-level object of the config (module.exports, export default, defineConfig(…), a helper object spread
 * into it); a key of a nested object (a color named `important` in theme.colors) is not the option.
 */
export function tailwindImportantOption(ts, sf) {
  const found = [];
  const isTopLevel = (object) => {
    let parent = object.parent;
    while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || (ts.isSatisfiesExpression?.(parent) ?? false))) parent = parent.parent;
    return !parent || !(ts.isPropertyAssignment(parent) || ts.isArrayLiteralExpression(parent));
  };
  const visit = (node) => {
    const named = ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node);
    if (named && propertyName(ts, node.name) === "important" && ts.isObjectLiteralExpression(node.parent) && isTopLevel(node.parent)) {
      const value = ts.isPropertyAssignment(node) ? node.initializer : node.name;
      if (value.kind !== ts.SyntaxKind.FalseKeyword) found.push({ node, value: `important: ${value.getText(sf).replace(/\s+/g, " ").slice(0, 60)}` });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Specifiers of `@config` and `@plugin` in a stylesheet (relative paths only; package names are not ours). */
function tailwindReferences(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/@(config|plugin)\s+(["'])([^"']+)\2/g)]
    .filter((m) => m[3].startsWith("."))
    .map((m) => ({ kind: m[1], specifier: m[3] }));
}

/** Relative files a Tailwind config loads with require()/import (local plugins, presets). */
function localModules(ts, sf) {
  const specifiers = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
      const arg = node.arguments[0];
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) specifiers.push(arg.text);
    } else if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specifiers.filter((s) => s.startsWith("."));
}

/** Name of a callee: `cn`, `twMerge`, `el.classList.add` → `.classList.add` suffix form. */
function calleeName(ts, expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return `${ts.isPropertyAccessExpression(expression.expression) ? `.${expression.expression.name.text}` : ""}.${expression.name.text}`;
  return "";
}

const propertyName = (ts, name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) || ts.isPrivateIdentifier(name) ? name.text : null);

/** Whether a string node is a class list: className/class attribute, cn/clsx/cva… argument, *ClassName name. */
function inClassContext(ts, node) {
  let current = node;
  for (let depth = 0; current.parent && depth < 16; depth += 1) {
    const parent = current.parent;
    if (ts.isJsxAttribute(parent)) return CLASS_NAME.test(parent.name.getText());
    if (ts.isPropertyAssignment(parent)) {
      const name = parent.initializer === current ? propertyName(ts, parent.name) : null;
      if (name !== null && CLASS_NAME.test(name)) return true;
    } else if (ts.isVariableDeclaration(parent)) {
      return ts.isIdentifier(parent.name) && CLASS_NAME.test(parent.name.text);
    } else if (ts.isCallExpression(parent)) {
      if (parent.expression === current) return false;
      const callee = calleeName(ts, parent.expression);
      return CLASS_FUNCTIONS.has(callee) || CLASS_LIST_CALL.test(callee);
    } else if (ts.isTaggedTemplateExpression(parent)) {
      return CLASS_FUNCTIONS.has(calleeName(ts, parent.tag));
    } else if (ts.isConditionalExpression(parent)) {
      // `a === "Link copiado!" ? "x" : ""`: the condition is not part of the class list.
      if (parent.condition === current) return false;
    } else if (ts.isBinaryExpression(parent)) {
      // Only operators that yield one of their operands (or join them) carry a class string.
      if (![ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(parent.operatorToken.kind)) return false;
    } else if (
      !(ts.isParenthesizedExpression(parent) ||
        ts.isTemplateSpan(parent) || ts.isTemplateExpression(parent) || ts.isArrayLiteralExpression(parent) ||
        ts.isObjectLiteralExpression(parent) || ts.isSpreadElement(parent) || ts.isAsExpression(parent) ||
        ts.isNonNullExpression(parent) || (ts.isSatisfiesExpression?.(parent) ?? false) || ts.isJsxExpression(parent) ||
        ts.isReturnStatement(parent) || ts.isBlock(parent) || ts.isArrowFunction(parent) || ts.isFunctionExpression(parent))
    ) {
      return false;
    }
    current = parent;
  }
  return false;
}

/** Classic compiler surface used by checkCode (createSourceFile + ScriptKind + guards). */
function isClassicCompilerApi(ts) {
  return Boolean(ts && typeof ts.createSourceFile === "function" && ts.ScriptKind && ts.ScriptTarget);
}

/**
 * TypeScript 7+ ships a native tsc; `require("typescript")` only exports version fields.
 * ScriptKind / createSourceFile-from-text live on older packages (or @typescript/typescript6),
 * not on the TS7 package root. Prefer a classic API already present in the install tree.
 */
function resolveClassicTypeScript(require, root) {
  try {
    const ts6 = require("@typescript/typescript6");
    if (isClassicCompilerApi(ts6)) return ts6;
  } catch {
    /* optional compat package */
  }
  const pnpm = path.join(root, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpm)) return null;
  const dirs = fs
    .readdirSync(pnpm)
    .filter((d) => /^typescript@[56]\./.test(d))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const d of dirs) {
    const pkg = path.join(pnpm, d, "node_modules", "typescript");
    if (!fs.existsSync(path.join(pkg, "lib", "typescript.js"))) continue;
    try {
      const ts = require(pkg);
      if (isClassicCompilerApi(ts)) return ts;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function loadTypeScript(root) {
  for (const base of [path.join(root, "package.json"), fileURLToPath(import.meta.url)]) {
    try {
      const require = createRequire(base);
      const main = require("typescript");
      if (isClassicCompilerApi(main)) return main;
      // TS7 root is version-only; unstable/ast has ScriptKind but no text→AST createSourceFile.
      const classic = resolveClassicTypeScript(require, root);
      if (classic) return classic;
    } catch {
      /* try the next location */
    }
  }
  throw new Error(
    "typescript classic compiler API (createSourceFile/ScriptKind) is not available; TypeScript 7 only exports version from the package root — install @typescript/typescript6 or keep a typescript@5/6 in the tree",
  );
}

export function loadTokenConfig(root) {
  const file = path.join(root, "arch.config.json");
  const user = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")).tokens ?? {}) : {};
  return { ...DEFAULT_TOKEN_CONFIG, ...user };
}

const toPosix = (p) => p.split(path.sep).join("/");

function listFiles(root, rel, ignoreDirs, acc) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return acc;
  const stat = fs.lstatSync(dir);
  if (stat.isSymbolicLink()) return acc;
  // A scope entry may be a single file (proxy.ts).
  if (stat.isFile()) {
    acc.push(rel);
    return acc;
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!ignoreDirs.includes(e.name)) listFiles(root, child, ignoreDirs, acc);
    } else if (e.isFile()) acc.push(child);
  }
  return acc;
}

function isNonZeroNumber(text) {
  const n = Number(text);
  return Number.isFinite(n) && n !== 0;
}

function dimensionsIn(text) {
  return [...text.matchAll(DIMENSION)].map((m) => m[0]).filter((v) => isNonZeroNumber(v.replace(/[a-z%]+$/i, "")) && !v.endsWith("%"));
}

function colorIn(text) {
  const hex = text.match(HEX);
  if (hex) return hex[0];
  // A complete var() is already a token reference, but its literal fallback is not.
  const withoutPureVars = text.replace(/var\(\s*--[\w-]+\s*\)/g, "");
  const functions = [...withoutPureVars.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*([^)]*)\)/gi)];
  if (functions.length && functions.every(match => !match[1].trim())) return null;
  const fn = text.match(COLOR_FN);
  if (fn) return text.slice(fn.index, text.indexOf(")", fn.index) + 1 || undefined);
  return null;
}

/** Tailwind utility of a class token, without variants (`hover:`, `md:`, `[&_svg]:`) and `!`. */
function utilityOf(token) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    const c = token[i];
    if (c === "[" || c === "(") depth += 1;
    else if ((c === "]" || c === ")") && depth > 0) depth -= 1;
    else if (c === ":" && depth === 0) start = i + 1;
  }
  return token.slice(start).replace(/^!/, "").replace(/!$/, "");
}

/** Non-zero lengths in a value; a complete var() is a token reference, its fallback is not. */
function lengthsIn(text) {
  const withoutPureVars = text.replace(/var\(\s*--[\w-]+\s*\)/g, "");
  return [...withoutPureVars.matchAll(LENGTH)].map((m) => m[0]).filter((v) => isNonZeroNumber(v.replace(/[a-z]+$/i, "")));
}

const isZLiteral = (value) => Z_LITERAL.test(value.replace(IMPORTANT, "").trim());
const isHslTriple = (value) => HSL_TRIPLE.test(value.replace(IMPORTANT, "").trim());

/** Theme key of a theme()/--theme() argument as its variable: `colors.orange[600]` → `--color-orange-600`. */
function themeVariable(argument, dashed) {
  const name = argument.replace(/\[['"]?([^\]'"]*)['"]?\]/g, ".$1");
  if (name.startsWith("--")) return name;
  // --theme() only takes a variable; theme() also takes the key path.
  return !dashed && name.startsWith("colors.") ? `--color-${name.slice("colors.".length).replace(/\./g, "-")}` : null;
}

/** Whether an arbitrary value of the utility reads a default palette color (var(), theme() or --theme()). */
function readsPalette(utility) {
  // Quoted text is a string, except the argument of theme().
  const unquoted = utility.replace(QUOTED, (match, theme) => (theme ? match : "''"));
  for (const m of unquoted.matchAll(VAR_NAME)) if (PALETTE_NAME.test(m[1])) return true;
  // Tailwind turns unescaped underscores into spaces outside var() names: theme(colors.orange.600_/_50%).
  const spaced = unquoted.replace(/(?<!\\)_/g, " ");
  for (const m of spaced.matchAll(THEME_ARGUMENT)) {
    const variable = themeVariable(m[2], Boolean(m[1]));
    if (variable && PALETTE_NAME.test(variable)) return true;
  }
  return false;
}

/** Tailwind classes in a string that write a design value instead of reading a token. */
export function classFindings(text) {
  const found = [];
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const utility = utilityOf(token);
    if (PALETTE_CLASS.test(utility)) {
      found.push({ rule: "tailwind-palette-class", value: token });
      continue;
    }
    if (PALETTE_VARIABLE_CLASS.test(utility) || PALETTE_VARIABLE_PROPERTY.test(utility)) {
      found.push({ rule: "tailwind-palette-class", value: token });
      // A literal fallback (`var(--color-orange-600,#fff)`) is still a color literal for the absolute rule.
      const literal = colorIn(utility.replace(/_/g, " "));
      if (literal) found.push({ rule: "color-literal", value: literal, token });
      continue;
    }
    if (Z_UTILITY.test(utility)) {
      if (Z_CLASS.test(utility)) found.push({ rule: "z-index-literal", value: token });
      continue;
    }
    // The palette read anywhere else in an arbitrary value; its literals and lengths still go to their own rules below.
    if (readsPalette(utility)) found.push({ rule: "tailwind-palette-class", value: token });
    const arbitrary = utility.match(ARBITRARY_VALUE);
    const property = arbitrary ? null : utility.match(ARBITRARY_PROPERTY);
    if (!arbitrary && !property) continue;
    const content = (arbitrary ? arbitrary[1] : property[2]).replace(/_/g, " ");
    if (property?.[1] === "z-index") {
      if (isZLiteral(content)) found.push({ rule: "z-index-literal", value: token });
      continue;
    }
    if (property?.[1].startsWith("--") && isHslTriple(content)) found.push({ rule: "hsl-triple", value: token });
    else if (colorIn(content)) {
      // `bg-[#ea580c]` was always visible to the absolute color-literal rule and stays there;
      // `shadow-[0_0_20px_rgba(…)]` was not (`_rgba(` has no word boundary) and is ratcheted.
      const visible = colorIn(utility);
      found.push(visible ? { rule: "color-literal", value: visible, token } : { rule: "arbitrary-color", value: token, token });
    } else if (lengthsIn(content).length) found.push({ rule: "arbitrary-dimension", value: token });
  }
  return found;
}

/** Name of the style property (or JSX attribute) that receives `node`, if any. */
function propertyOf(ts, node) {
  let current = node;
  while (current.parent && (ts.isParenthesizedExpression(current.parent) || ts.isConditionalExpression(current.parent) || ts.isBinaryExpression(current.parent) || ts.isTemplateSpan(current.parent) || ts.isTemplateExpression(current.parent) || ts.isPrefixUnaryExpression(current.parent) || ts.isAsExpression(current.parent) || ts.isJsxExpression(current.parent))) current = current.parent;
  const parent = current.parent;
  if (parent && ts.isPropertyAssignment(parent) && parent.initializer === current) return parent.name.getText().replace(/^["']|["']$/g, "");
  if (parent && ts.isJsxAttribute(parent)) return parent.name.getText();
  return null;
}

function inTypePosition(ts, node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isTypeNode(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return true;
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isExternalModuleReference(n)) return true;
    if (ts.isCallExpression(n) && n.expression.getText() === "require") return true;
    if (ts.isBlock(n) || ts.isSourceFile(n)) return false;
  }
  return false;
}

function allowReason(lines, line) {
  for (const l of [lines[line], lines[line - 1]]) {
    const m = l?.match(ALLOW_COMMENT);
    if (m) return m[1].trim();
  }
  return null;
}

/** A JavaScript escape (`\u00e7`, `\u{e7}`, `\xe7`) in raw source text. */
const JS_ESCAPE = /\\(?:u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\}|x[0-9a-fA-F]{2})/;
/** JSX attributes whose value is a regular expression, where an escape is intentional. */
const REGEX_ATTRIBUTES = new Set(["pattern"]);

/** `jsxEscapes`: report jsx-text-escape (JSX files of the product scope). */
function checkCode(ts, rel, text, tokenExports, report, { jsxEscapes = false } = {}) {
  const kind = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : rel.endsWith(".jsx") ? ts.ScriptKind.JSX : rel.match(/\.[cm]?js$/) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind);
  const lines = text.split(/\r?\n/);
  const localNumbers = new Map();
  const found = [];
  const addAt = (line, character, rule, property, value) => {
    const entry = { file: rel, line: line + 1, column: character + 1, rule, property, value };
    // css-important has no exception: no comment exempts it.
    const reason = ZERO_TOLERANCE.has(rule) ? null : allowReason(lines, line);
    if (reason === null) found.push(entry);
    else if (reason.length < 8) found.push({ ...entry, rule: "exception-without-reason" });
    else report.allowed.push({ ...entry, reason });
  };
  const add = (node, rule, property, value) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    addAt(line, character, rule, property, value);
  };
  // `!important` in a string or template: the whole template is read at once (with ${…} as a neutral
  // placeholder) so that a declaration split by a substitution (`top: ${y}px !important`) is still reported whole.
  const importantInLiteral = (node) => {
    const parts = ts.isTemplateExpression(node) ? [node.head, ...node.templateSpans.map((span) => span.literal)] : [node];
    let text = "";
    const offsets = [];
    for (const [index, part] of parts.entries()) {
      if (index > 0) text += " __expr__ ";
      offsets.push({ start: text.length, part });
      text += part.text;
    }
    for (const hit of importantDeclarations(text)) {
      const { start, part } = offsets.filter((o) => o.start <= hit.index).pop();
      const { line, character } = sf.getLineAndCharacterOfPosition(part.getStart(sf));
      const before = part.text.slice(0, hit.index - start);
      const newlines = before.split("\n").length - 1;
      addAt(line + newlines, newlines ? before.length - before.lastIndexOf("\n") - 1 : character, "css-important", "style", hit.value);
    }
  };
  const visit = (node) => {
    if (jsxEscapes && ts.isJsxText(node)) {
      const escape = JS_ESCAPE.exec(node.getText(sf));
      if (escape) add(node, "jsx-text-escape", "JSX text", escape[0]);
    }
    if (jsxEscapes && ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && !REGEX_ATTRIBUTES.has(node.name.getText(sf))) {
      const escape = JS_ESCAPE.exec(node.initializer.getText(sf));
      if (escape) add(node.initializer, "jsx-text-escape", node.name.getText(sf), escape[0]);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = ts.isPrefixUnaryExpression(node.initializer) ? node.initializer.operand : node.initializer;
      if (ts.isNumericLiteral(init) && isNonZeroNumber(init.text)) localNumbers.set(node.name.text, init.text);
      if (tokenExports.has(node.name.text) && (ts.isObjectLiteralExpression(node.initializer) || ts.isNumericLiteral(init))) add(node.name, "token-redefinition", node.name.text, node.initializer.getText().slice(0, 40));
    }
    const isString = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && !inTypePosition(ts, node)) {
      importantInLiteral(node);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "setProperty") {
      const priority = node.arguments[2];
      if (priority && (ts.isStringLiteral(priority) || ts.isNoSubstitutionTemplateLiteral(priority)) && priority.text.trim().toLowerCase() === "important") {
        add(priority, "css-important", "setProperty", `setProperty(${node.arguments[0]?.getText(sf) ?? ""}, …, "important")`);
      }
    }
    if (isString && !inTypePosition(ts, node)) {
      const value = node.text;
      const property = propertyOf(ts, node);
      const classes = classFindings(value);
      for (const c of classes) add(node, c.rule, property, c.value);
      const literal = ts.isTemplateHead(node) ? node.parent : ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.parent.parent : node;
      for (const c of importantClassFindings(value, { classContext: inClassContext(ts, literal) })) add(node, c.rule, property, c.value);
      // A color inside a Tailwind arbitrary value was just reported; do not report it twice.
      const arbitraryColors = new Set(classes.filter((c) => c.token).map((c) => c.token));
      const rest = arbitraryColors.size ? value.split(/(\s+)/).filter((t) => !arbitraryColors.has(t)).join("") : value;
      const color = colorIn(rest);
      if (color) add(node, "color-literal", property, color);
      else if (property && COLOR_PROP.test(property) && NAMED.has(value.trim().toLowerCase())) add(node, "named-color", property, value.trim());
      if (property && (DIM_PROP.test(property) || SHORTHAND.test(property))) for (const d of dimensionsIn(value)) add(node, "dimension-literal", property, d);
      if (property && WEIGHT_PROP.test(property) && /^(\d{3}|bold|bolder|lighter|normal)$/i.test(value.trim())) add(node, "font-weight-literal", property, value.trim());
      if (property?.startsWith("--") && isHslTriple(value)) add(node, "hsl-triple", property, value.trim());
      if (property === "zIndex" && isZLiteral(value)) add(node, "z-index-literal", property, value.trim());
    }
    if (ts.isNumericLiteral(node) && !inTypePosition(ts, node)) {
      const property = propertyOf(ts, node);
      const negative = ts.isPrefixUnaryExpression(node.parent) && node.parent.operator === ts.SyntaxKind.MinusToken;
      if (property === "zIndex") add(node, "z-index-literal", property, `${negative ? "-" : ""}${node.text}`);
      else if (isNonZeroNumber(node.text) && property && (DIM_PROP.test(property) || WEIGHT_PROP.test(property))) add(node, "number-literal", property, node.text);
    }
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.initializer) && localNumbers.has(node.initializer.text)) {
      const property = node.name.getText().replace(/^["']|["']$/g, "");
      if (DIM_PROP.test(property)) add(node.initializer, "local-constant", property, `${node.initializer.text} = ${localNumbers.get(node.initializer.text)}`);
      if (property === "zIndex") add(node.initializer, "z-index-literal", property, `${node.initializer.text} = ${localNumbers.get(node.initializer.text)}`);
    }
    if (ts.isShorthandPropertyAssignment(node) && localNumbers.has(node.name.text) && DIM_PROP.test(node.name.text)) add(node, "local-constant", node.name.text, `${node.name.text} = ${localNumbers.get(node.name.text)}`);
    if (ts.isShorthandPropertyAssignment(node) && localNumbers.has(node.name.text) && node.name.text === "zIndex") add(node, "z-index-literal", node.name.text, `${node.name.text} = ${localNumbers.get(node.name.text)}`);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * Stylesheet rules. `onlyImportant`: preprocessor files (.scss .sass .less, with `//` comments) and the canonical
 * token source, where only css-important applies.
 */
function checkCss(rel, text, report, { onlyImportant = false, lineComments = false } = {}) {
  const found = [];
  const lines = text.split(/\r?\n/);
  const lineStarts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) lineStarts.push(i + 1);
  const lineOf = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const push = (index, rule, property, v) => {
    const line = lineOf(index);
    const reason = ZERO_TOLERANCE.has(rule) ? null : allowReason(lines, line - 1);
    const entry = { file: rel, line, column: 1, rule, property, value: v };
    if (reason === null) found.push(entry);
    else report.allowed.push({ ...entry, reason });
  };
  // Blanking keeps every offset, so line numbers stay exact.
  const blank = (m) => m.replace(/[^\n]/g, " ");
  let clean = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (lineComments) clean = clean.replace(/(^|[\s;{}])(\/\/[^\n]*)/g, (m, lead, comment) => lead + blank(comment));
  for (const hit of importantDeclarations(clean)) push(hit.index, "css-important", "!important", hit.value);
  // `@apply` lists Tailwind classes; it is not a declaration.
  clean = clean.replace(/@apply\s+([^;{}]+)/g, (m, list, offset) => {
    if (!onlyImportant) for (const c of classFindings(list)) push(offset, c.rule, "@apply", c.value);
    for (const c of importantClassFindings(list, { classContext: true })) push(offset, c.rule, "@apply", c.value);
    return blank(m);
  });
  if (onlyImportant) return found;
  for (const m of clean.matchAll(/(-{0,2}[a-zA-Z][\w-]*)\s*:\s*([^;{}]+)[;}]/g)) {
    const property = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = m[2].trim();
    if (m[1].startsWith("--")) {
      if (colorIn(value)) push(m.index, "custom-property-definition", property, colorIn(value));
      else if (isHslTriple(value)) push(m.index, "hsl-triple", m[1], value);
      continue;
    }
    const color = colorIn(value);
    if (color) push(m.index, "color-literal", property, color);
    else if (COLOR_PROP.test(property) && value.split(/\s+/).some((w) => NAMED.has(w.toLowerCase()) && !CSS_KEYWORDS.has(w.toLowerCase()))) push(m.index, "named-color", property, value);
    if (DIM_PROP.test(property) || SHORTHAND.test(property)) for (const d of dimensionsIn(value.replace(/var\([^)]*\)/g, ""))) push(m.index, "dimension-literal", property, d);
    if (property === "zIndex" && isZLiteral(value)) push(m.index, "z-index-literal", property, value);
  }
  return found;
}

export function baselinePath(root, config = loadTokenConfig(root)) {
  return path.resolve(root, config.baseline ?? DEFAULT_TOKEN_CONFIG.baseline);
}

/**
 * Reads the ratchet baseline: `null` when absent; throws on a malformed file. Absolute rules may only
 * appear for files of the legacy scope; the declared `totals`, when present, must match the entries.
 */
export function readBaseline(file, { legacyScope = DEFAULT_TOKEN_CONFIG.legacyScope } = {}) {
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const files = data?.files;
  if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error(`${file}: expected an object "files": { "<path>": { "<rule>": <count> } }`);
  for (const [rel, counts] of Object.entries(files)) {
    for (const [rule, n] of Object.entries(counts ?? {})) {
      if (ZERO_TOLERANCE.has(rule)) throw new Error(`${file}: ${rel} lists "${rule}", a zero-tolerance rule: no occurrence is allowed anywhere, so the baseline cannot count it`);
      const legacyRule = inScope(rel, legacyScope) && ALL_RULES.includes(rule);
      if (!RATCHET_RULES.includes(rule) && !legacyRule) throw new Error(`${file}: ${rel} lists "${rule}", which is not a ratchet rule (${RATCHET_RULES.join(", ")}; every token rule only in ${legacyScope.join(", ")})`);
      if (!Number.isInteger(n) || n < 1) throw new Error(`${file}: ${rel} ${rule} must be a positive integer, got ${JSON.stringify(n)}`);
    }
  }
  if (data.totals !== undefined) {
    const sums = totalsOf(files);
    for (const rule of new Set([...Object.keys(data.totals ?? {}), ...Object.keys(sums)])) {
      if ((data.totals?.[rule] ?? 0) !== (sums[rule] ?? 0)) throw new Error(`${file}: declared ${rule} total ${data.totals?.[rule]} differs from the sum of its entries (${sums[rule] ?? 0})`);
    }
  }
  return { files };
}

/** Occurrences per file and rule, zero counts omitted, keys sorted (ratchet rules first). */
function countByFile(findings) {
  const counts = {};
  for (const f of findings) {
    counts[f.file] ??= {};
    counts[f.file][f.rule] = (counts[f.file][f.rule] ?? 0) + 1;
  }
  return Object.fromEntries(Object.keys(counts).sort().map((file) => [file, Object.fromEntries(ALL_RULES.filter((r) => counts[file][r]).map((r) => [r, counts[file][r]]))]));
}

/** Totals per rule: every ratchet rule, plus the absolute rules that have legacy entries. */
export function totalsOf(counts) {
  const totals = Object.fromEntries(RATCHET_RULES.map((r) => [r, 0]));
  for (const byRule of Object.values(counts)) for (const [rule, n] of Object.entries(byRule)) totals[rule] = (totals[rule] ?? 0) + n;
  return Object.fromEntries(ALL_RULES.filter((r) => r in totals).map((r) => [r, totals[r]]));
}

/** Compares current counts with the baseline; absent entries count as zero. */
export function compareWithBaseline(counts, baseline) {
  const recorded = baseline?.files ?? {};
  const increases = [];
  const decreases = [];
  for (const file of [...new Set([...Object.keys(counts), ...Object.keys(recorded)])].sort()) {
    for (const rule of ALL_RULES.filter((r) => counts[file]?.[r] !== undefined || recorded[file]?.[r] !== undefined)) {
      const current = counts[file]?.[rule] ?? 0;
      const allowed = recorded[file]?.[rule] ?? 0;
      if (current > allowed) increases.push({ file, rule, baseline: allowed, current, newFile: !(file in recorded) });
      else if (current < allowed) decreases.push({ file, rule, baseline: allowed, current });
    }
  }
  return { increases, decreases };
}

/** Root Tailwind JS configs (read by Tailwind 3 on its own, and by Tailwind 4 when a stylesheet loads them). */
const ROOT_TAILWIND_CONFIGS = ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.ts"];

/**
 * css-important in the Tailwind JS sources: the configs (`@config` of a stylesheet read, and the root
 * tailwind.config.*) and the local plugins (`@plugin`, or a relative require/import of a config or plugin), wherever
 * they live. A file not examined yet is read for css-important only (`!important` strings in addUtilities, addBase…);
 * a config also for its `important` option. Returns the files read, with their kind.
 */
function checkTailwindSources(ts, root, config, refs, seen, report) {
  const queue = [
    ...ROOT_TAILWIND_CONFIGS.map((rel) => ({ kind: "config", rel })),
    ...refs.map(({ kind, rel }) => ({ kind, rel })),
  ];
  const done = new Map();
  while (queue.length) {
    const { kind, rel } = queue.shift();
    const absolute = path.resolve(root, rel);
    const inside = !path.relative(root, absolute).startsWith("..") && !path.isAbsolute(path.relative(root, absolute));
    if (!inside || !CODE.test(rel) || rel.split("/").some((part) => config.ignoreDirs.includes(part))) continue;
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    if (done.get(rel) === "config" || done.get(rel) === kind) continue;
    done.set(rel, kind);
    const text = fs.readFileSync(absolute, "utf8");
    const scriptKind = rel.endsWith(".ts") || rel.endsWith(".mts") || rel.endsWith(".cts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKind);
    if (!seen.has(rel)) {
      seen.add(rel);
      report.examined.code += 1;
      for (const v of checkCode(ts, rel, text, new Set(), { allowed: [] }).filter((f) => f.rule === "css-important")) report.violations.push(v);
    }
    if (kind === "config") {
      for (const hit of tailwindImportantOption(ts, sf)) {
        const { line, character } = sf.getLineAndCharacterOfPosition(hit.node.getStart(sf));
        report.violations.push({ file: rel, line: line + 1, column: character + 1, rule: "css-important", property: "important", value: hit.value });
      }
    }
    for (const specifier of localModules(ts, sf)) {
      const target = toPosix(path.relative(root, path.resolve(path.dirname(absolute), specifier)));
      queue.push({ kind: "plugin", rel: target });
    }
  }
  return [...done].map(([file, kind]) => ({ file, kind }));
}

export function checkTokens(root, config = loadTokenConfig(root), baseline = readBaseline(baselinePath(root, config), config)) {
  const ts = loadTypeScript(root);
  const ignoreFiles = config.ignoreFiles.map((p) => new RegExp(p));
  const legacyScope = config.legacyScope ?? [];
  const report = { root, examined: { code: 0, css: 0 }, notExamined: {}, ignored: 0, allowed: [], violations: [], ratcheted: [], ratchet: null, config: { scope: config.scope, legacyScope, canonical: config.canonical } };
  const tokenExports = new Set();
  for (const dir of config.canonical) {
    const index = path.join(root, dir, "index.ts");
    if (fs.existsSync(index)) for (const m of fs.readFileSync(index, "utf8").matchAll(/export\s*\{([^}]+)\}/g)) for (const n of m[1].split(",")) if (!/^\s*type\s/.test(n)) tokenExports.add(n.trim().split(/\s+as\s+/).pop());
  }
  for (const entry of config.allow) if (!entry.file || !entry.value || !entry.reason || String(entry.reason).length < 8) report.violations.push({ file: "arch.config.json", line: 0, column: 0, rule: "exception-without-reason", property: null, value: JSON.stringify(entry) });
  const seen = new Set();
  /** `@config`/`@plugin` targets of the stylesheets read, resolved from the product root. */
  const tailwindRefs = [];
  // The canonical source defines tokens, so only css-important applies there (nothing justifies !important).
  for (const scope of [...config.scope, ...legacyScope, ...config.canonical]) {
    for (const rel of listFiles(root, scope, config.ignoreDirs, [])) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      const canonical = inScope(rel, config.canonical);
      const legacy = inScope(rel, legacyScope) && !inScope(rel, config.scope);
      if (ignoreFiles.some((re) => re.test(rel))) {
        report.ignored += 1;
        continue;
      }
      const text = fs.readFileSync(path.join(root, ...rel.split("/")), "utf8");
      let found;
      if (CODE.test(rel) && !rel.endsWith(".d.ts")) {
        report.examined.code += 1;
        found = canonical
          ? checkCode(ts, rel, text, new Set(), { allowed: [] }).filter((v) => v.rule === "css-important")
          : checkCode(ts, rel, text, tokenExports, report, { jsxEscapes: inScope(rel, config.scope) && /\.[jt]sx$/.test(rel) });
      } else if (CSS.test(rel) || STYLESHEET.test(rel)) {
        report.examined.css += 1;
        found = checkCss(rel, text, report, { onlyImportant: canonical || STYLESHEET.test(rel), lineComments: STYLESHEET.test(rel) });
        for (const ref of tailwindReferences(text)) tailwindRefs.push({ ...ref, rel: toPosix(path.relative(root, path.resolve(root, path.dirname(rel), ref.specifier))) });
      } else {
        const ext = path.extname(rel) || path.basename(rel);
        report.notExamined[ext] = (report.notExamined[ext] ?? 0) + 1;
        continue;
      }
      for (const v of found) {
        const allowed = !ZERO_TOLERANCE.has(v.rule) && config.allow.find((a) => a.file === v.file && a.value === v.value && a.reason && String(a.reason).length >= 8);
        if (allowed) report.allowed.push({ ...v, reason: allowed.reason });
        else if (ZERO_TOLERANCE.has(v.rule)) report.violations.push(v);
        else if (RATCHET_RULES.includes(v.rule) || legacy) report.ratcheted.push(legacy ? { ...v, legacy: true } : v);
        else report.violations.push(v);
      }
    }
  }
  report.tailwind = checkTailwindSources(ts, root, config, tailwindRefs, seen, report);
  report.zeroTolerance = Object.fromEntries(ZERO_TOLERANCE_RULES.map((rule) => [rule, report.violations.filter((v) => v.rule === rule).length]));
  const counts = countByFile(report.ratcheted);
  const { increases, decreases } = compareWithBaseline(counts, baseline);
  report.ratchet = {
    baseline: toPosix(path.relative(root, baselinePath(root, config))),
    baselineFound: baseline !== null,
    rules: RATCHET_RULES,
    totals: totalsOf(counts),
    baselineTotals: totalsOf(baseline?.files ?? {}),
    counts,
    increases,
    decreases,
  };
  // Which occurrence is new cannot be told apart, so every occurrence of an exceeded pair is listed.
  for (const inc of increases) for (const v of report.ratcheted) if (v.file === inc.file && v.rule === inc.rule) report.violations.push({ ...v, ratchet: { baseline: inc.baseline, current: inc.current } });
  return report;
}

/** Baseline file body for per-file counts (used by --update-baseline and tools/ratchet-guard.mjs). */
export function serializeBaseline(counts) {
  const sorted = Object.fromEntries(Object.keys(counts).sort().map((file) => [file, Object.fromEntries(ALL_RULES.filter((r) => counts[file][r]).map((r) => [r, counts[file][r]]))]));
  const body = {
    description: "Catraca de tools/token-check.mjs: ocorrências permitidas por arquivo e regra. Só pode diminuir; aumento ou arquivo novo com violação reprova `pnpm tokens`. Regenerar apenas com `node tools/token-check.mjs --update-baseline` (recusa aumento). Na raiz legada (legacyScope) toda regra é catraca, inclusive as absolutas. `totals` precisa bater com a soma das entradas; tools/ratchet-guard.mjs compara este arquivo com o da base no CI. `css-important` é de tolerância zero: fica em `rules` com cota zero e nenhuma entrada pode contá-la.",
    rules: BASELINE_RULES,
    totals: totalsOf(sorted),
    files: sorted,
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

function writeBaseline(file, counts) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serializeBaseline(counts));
}

/**
 * Rewrites the baseline from the current tree. `init` creates it and refuses when it exists;
 * otherwise it must exist and any file/rule above its recorded count refuses the whole update.
 */
export function updateBaseline(root, config = loadTokenConfig(root), { init = false } = {}) {
  const file = baselinePath(root, config);
  const rel = toPosix(path.relative(root, file));
  const existing = readBaseline(file, config);
  if (init && existing) return { written: false, reason: `${rel} já existe; use --update-baseline, que só aceita reduções` };
  if (!init && !existing) return { written: false, reason: `${rel} não existe; crie-o uma vez com --init-baseline` };
  const report = checkTokens(root, config, existing);
  const { increases, decreases, counts } = report.ratchet;
  if (!init && increases.length) return { written: false, reason: `recusado: ${increases.length} par(es) arquivo/regra acima da baseline`, increases };
  if (!init && !decreases.length) return { written: false, unchanged: true, reason: `${rel} já reflete a árvore; nada diminuiu` };
  writeBaseline(file, counts);
  return { written: true, file: rel, totals: totalsOf(counts), decreases };
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
const self = fileURLToPath(import.meta.url);
if (process.platform === "win32" ? invoked.toLowerCase() === self.toLowerCase() : invoked === self) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf("--root");
  const root = path.resolve(rootIndex === -1 ? process.cwd() : args[rootIndex + 1]);
  const init = args.includes("--init-baseline");
  if (init || args.includes("--update-baseline")) {
    const result = updateBaseline(root, loadTokenConfig(root), { init });
    if (result.written) {
      process.stdout.write(`baseline written: ${result.file} — ${Object.entries(result.totals).map(([r, n]) => `${r}=${n}`).join(", ")}\n`);
      for (const d of result.decreases) process.stdout.write(`  lowered ${d.file} ${d.rule}: ${d.baseline} -> ${d.current}\n`);
    } else {
      process.stdout.write(`baseline not written: ${result.reason}\n`);
      for (const i of result.increases ?? []) process.stdout.write(`  ${i.newFile ? "new file" : "increase"} ${i.file} ${i.rule}: ${i.baseline} -> ${i.current}\n`);
    }
    process.exitCode = result.written || result.unchanged ? 0 : 1;
  } else {
    const report = checkTokens(root);
    const { ratchet } = report;
    if (args.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      for (const v of report.violations) process.stdout.write(`TOKEN ${v.rule} ${v.file}:${v.line}:${v.column}${v.property ? ` ${v.property}` : ""} ${v.value}${v.ratchet ? ` (catraca: ${v.ratchet.current} > baseline ${v.ratchet.baseline})` : ""}\n`);
      for (const a of report.allowed) process.stdout.write(`allowed ${a.file}:${a.line} ${a.value} (${a.reason})\n`);
      for (const i of ratchet.increases) process.stdout.write(`RATCHET ${i.newFile ? "new file" : "increase"} ${i.file} ${i.rule}: baseline ${i.baseline}, now ${i.current}\n`);
      if (!ratchet.baselineFound) process.stdout.write(`RATCHET ${ratchet.baseline} not found: every ratchet occurrence counts as new (create it once with --init-baseline)\n`);
      const shown = ALL_RULES.filter((r) => r in ratchet.totals || r in ratchet.baselineTotals);
      const totals = shown.map((r) => `${r} ${ratchet.totals[r] ?? 0}/${ratchet.baselineTotals[r] ?? 0}${RATCHET_RULES.includes(r) ? "" : " (raiz legada)"}`).join(", ");
      process.stdout.write(`ratchet (now/baseline): ${totals}\n`);
      process.stdout.write(`zero tolerance (every scope, no baseline): ${Object.entries(report.zeroTolerance).map(([r, n]) => `${r} ${n}`).join(", ")}\n`);
      process.stdout.write(`tailwind JS read for css-important: ${report.tailwind.map((t) => `${t.file} (${t.kind})`).join(", ") || "none"}\n`);
      if (ratchet.decreases.length) process.stdout.write(`ratchet: ${ratchet.decreases.length} file/rule pair(s) below baseline — lock them in with \`node tools/token-check.mjs --update-baseline\`\n`);
      const skipped = Object.entries(report.notExamined).map(([k, n]) => `${k}=${n}`).join(", ");
      process.stdout.write(`${report.violations.length ? `\n${report.violations.length} token violation(s)` : "token gate passed"} — examined ${report.examined.code} code and ${report.examined.css} CSS files; ${report.ignored} test/fixture files skipped; not examined: ${skipped || "none"}\n`);
    }
    process.exitCode = report.violations.length ? 1 : 0;
  }
}
