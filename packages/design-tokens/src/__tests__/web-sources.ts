/// <reference types="node" />
// Apoio aos testes de paridade: lê as fontes do web aprovado e normaliza valores CSS.
// Só testes importam este módulo (nunca o código do pacote).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hslTripleToHex, primitives } from "../primitives";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export function readRepoFile(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, ...relative.split("/")), "utf8");
}

/** Folhas `{ value }` de design-tokens/base.json, por caminho pontuado. */
export function readBaseJson(): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (node: unknown, prefix: string) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.value === "string") {
      out[prefix] = record.value;
      return;
    }
    for (const [key, child] of Object.entries(record)) visit(child, prefix ? `${prefix}.${key}` : key);
  };
  visit(JSON.parse(readRepoFile("design-tokens/base.json")), "");
  return out;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

export const THEME_CSS = "packages/design-tokens/src/theme.css";
export const TOKENS_CSS = "packages/design-tokens/src/tokens.css";

/**
 * Blocos :root/.dark de um CSS de tokens. Chave: "root", "dark" ou "root@<media>" para um :root dentro de @media;
 * blocos repetidos com a mesma chave (dois :root no topo) somam as declarações. Um bloco novo aparece com chave nova e
 * o teste de completude falha.
 */
export function readRootBlocks(file: string): Record<string, Record<string, string>> {
  const css = stripComments(readRepoFile(file));
  const out: Record<string, Record<string, string>> = {};
  for (const m of css.matchAll(/(^|\n)([ \t]*)(:root|\.dark)\s*\{([^}]*)\}/g)) {
    const selector = m[3] === ":root" ? "root" : "dark";
    let key = selector;
    if (m[2].length > 0) {
      const before = css.slice(0, m.index);
      const media = [...before.matchAll(/@media\s*([^{]+)\{/g)].pop();
      key = `${selector}@${media ? media[1].trim() : "?"}`;
    }
    out[key] = { ...out[key], ...declarations(m[4]) };
  }
  return out;
}

/** Tema do web (theme.css): triplas HSL do :root e do .dark, camadas e o :root de ≥640px. */
export function readThemeBlocks(): Record<string, Record<string, string>> {
  return readRootBlocks(THEME_CSS);
}

/** Tokens nomeados (tokens.css), com cada var() de outro token já resolvido. */
export function readTokensCss(): Record<string, string> {
  const blocks = readRootBlocks(TOKENS_CSS);
  if (Object.keys(blocks).join() !== "root") throw new Error(`tokens.css deve ter só blocos :root no topo: ${Object.keys(blocks).join(", ")}`);
  const raw = blocks.root;
  const resolve = (value: string, depth = 0): string =>
    value.replace(/var\((--[\w-]+)\)/g, (ref, name: string) => {
      if (depth > 8 || raw[name] === undefined) throw new Error(`var(${name}) sem token em tokens.css`);
      return resolve(raw[name], depth + 1);
    });
  return Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, resolve(value)]));
}

// ---- normalização --------------------------------------------------------------------

/** Multiplica um decimal em texto por um inteiro sem ponto flutuante ("0.7" × 16 = 11.2). */
export function decimalTimes(text: string, factor: number): number {
  const m = /^(-?)(\d*)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) throw new Error(`número inválido: "${text}"`);
  const frac = m[3] ?? "";
  const scaled = BigInt(`${m[2] || "0"}${frac}`) * BigInt(factor);
  const digits = scaled.toString().padStart(frac.length + 1, "0");
  const int = digits.slice(0, digits.length - frac.length);
  const dec = frac.length ? `.${digits.slice(digits.length - frac.length)}` : "";
  return Number(`${m[1]}${int}${dec}`);
}

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000", transparent: "#00000000" };

/** Cor CSS -> "r,g,b,a" (canais inteiros 0-255; alfa como declarado ou byte/255). */
export function colorKey(value: string, resolveVar?: (name: string) => string): string {
  let v = value.trim().toLowerCase();
  const varRef = /^hsl\(\s*var\((--[\w-]+)\)\s*\)$/.exec(v);
  if (varRef) {
    if (!resolveVar) throw new Error(`referência sem resolvedor: ${value}`);
    v = resolveVar(varRef[1]).trim();
  }
  if (NAMED[v]) v = NAMED[v];
  if (/^-?\d*\.?\d+\s+\d*\.?\d+%\s+\d*\.?\d+%$/.test(v)) v = hslTripleToHex(v);
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((ch) => ch + ch).join("");
    const bytes = [0, 2, 4, 6].map((i) => (i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255));
    return `${bytes[0]},${bytes[1]},${bytes[2]},${h.length === 8 ? bytes[3] / 255 : 1}`;
  }
  const fn = /^rgba?\(\s*([^)]*)\)$/.exec(v);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length !== 3 && parts.length !== 4) throw new Error(`rgb inválido: ${value}`);
    const [r, g, b] = parts.slice(0, 3).map((p) => {
      if (!/^\d+$/.test(p)) throw new Error(`canal não inteiro em ${value}`);
      return Number(p);
    });
    return `${r},${g},${b},${parts[3] === undefined ? 1 : alphaOf(parts[3])}`;
  }
  throw new Error(`cor não reconhecida: "${value}"`);
}

/** Alfa de rgb(): "0.1" ou "10%" -> 0.1, em aritmética decimal exata. */
function alphaOf(text: string): number {
  if (!text.endsWith("%")) return Number(text);
  const m = /^(\d+)(?:\.(\d+))?%$/.exec(text);
  if (!m) throw new Error(`alfa inválido: ${text}`);
  const digits = `${m[1]}${m[2] ?? ""}`.padStart((m[2] ?? "").length + 3, "0");
  const scale = (m[2] ?? "").length + 2;
  return Number(`${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`);
}

/** Cores de um valor composto (sombra), na ordem em que aparecem. */
export function colorsIn(value: string): string[] {
  return [...value.matchAll(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
}

/** Sombra normalizada: cada cor vira "r,g,b,a" e os espaços colapsam; o resto fica literal. */
function shadowKey(value: string): string {
  return value.replace(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g, (c) => `[${colorKey(c)}]`).replace(/\s+/g, " ").trim();
}

export type Kind = "color" | "px" | "em" | "vw" | "number" | "ms" | "string" | "shadow";

/** Valor da fonte normalizado para comparar com o primitivo, sem tolerância. */
export function normalizeSource(kind: Kind, value: string, resolveVar?: (name: string) => string): string | number {
  const v = value.trim();
  const unit = (re: RegExp) => {
    const m = re.exec(v);
    if (!m) throw new Error(`"${v}" não é ${kind}`);
    return m;
  };
  switch (kind) {
    case "color":
      return colorKey(v, resolveVar);
    case "px": {
      const m = unit(/^(-?\d*\.?\d+)(px|rem)$/);
      return m[2] === "rem" ? decimalTimes(m[1], 16) : Number(m[1]);
    }
    case "em":
      return Number(unit(/^(-?\d*\.?\d+)em$/)[1]);
    case "vw":
      return Number(unit(/^(\d*\.?\d+)vw$/)[1]);
    case "number": {
      const ref = /^var\((--[\w-]+)\)$/.exec(v);
      if (ref && !resolveVar) throw new Error(`referência sem resolvedor: ${v}`);
      const resolved = ref && resolveVar ? resolveVar(ref[1]).trim() : v;
      if (!/^-?\d*\.?\d+$/.test(resolved)) throw new Error(`"${v}" não é number`);
      return Number(resolved);
    }
    case "ms": {
      const m = unit(/^(\d*\.?\d+)(s|ms)$/);
      return m[2] === "s" ? decimalTimes(m[1], 1000) : Number(m[1]);
    }
    case "string":
      return v.replace(/\s+/g, " ");
    case "shadow":
      return shadowKey(v);
  }
}

/** Primitivo no mesmo formato de `normalizeSource`. */
export function normalizePrimitive(kind: Kind, value: unknown): string | number {
  if (kind === "color") return colorKey(String(value));
  if (kind === "string") return String(value).replace(/\s+/g, " ").trim();
  if (kind === "shadow") return shadowKey(String(value));
  if (typeof value !== "number") throw new Error(`primitivo ${kind} deveria ser número: ${String(value)}`);
  return value;
}

/** Resolve "typography.fluid.h1.minPx" ou "space.0.5" (chaves com ponto) em `primitives`. */
export function primitiveAt(pathText: string): unknown {
  const segments = pathText.split(".");
  let node: unknown = primitives;
  let i = 0;
  while (i < segments.length) {
    let advanced = false;
    for (let j = segments.length; j > i; j -= 1) {
      const key = segments.slice(i, j).join(".");
      if (node && typeof node === "object" && key in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[key];
        i = j;
        advanced = true;
        break;
      }
    }
    if (!advanced) throw new Error(`primitivo inexistente: ${pathText}`);
  }
  return node;
}

export type Mapping = Record<string, readonly [string, Kind]>;

/** Divergências de uma fonte contra o mapeamento: sem mapa, mapa órfão e valor diferente. */
export function parityProblems(source: Record<string, string>, mapping: Mapping, resolveVar?: (name: string) => string): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(source)) if (!mapping[key]) problems.push(`sem mapeamento: ${key} = ${source[key]}`);
  for (const [key, [primitivePath, kind]] of Object.entries(mapping)) {
    if (!(key in source)) {
      problems.push(`mapeamento órfão (fonte não tem mais): ${key}`);
      continue;
    }
    try {
      const expected = normalizeSource(kind, source[key], resolveVar);
      const actual = normalizePrimitive(kind, primitiveAt(primitivePath));
      if (!Object.is(expected, actual)) problems.push(`${key} = ${source[key]} (${String(expected)}) ≠ ${primitivePath} (${String(actual)})`);
    } catch (error) {
      problems.push(`${key}: ${(error as Error).message}`);
    }
  }
  return problems;
}

// ---- varredura do código web -----------------------------------------------------------

export const WEB_CODE_DIRS = ["packages/frontend/src", "packages/ui/src", "apps/clients/web/src"];

export function listWebFiles(): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    const abs = path.join(repoRoot, ...rel.split("/"));
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!["node_modules", ".next", "dist"].includes(e.name)) walk(child);
      } else if (/\.(tsx?|css|mdx)$/.test(e.name) && !/\.native\./.test(e.name)) out.push(child);
    }
  };
  for (const dir of WEB_CODE_DIRS) walk(dir);
  return out;
}
