#!/usr/bin/env node
// Asks whether a change to one canonical token reaches the Button of each client, and reports the
// answer per level without pretending. It never edits packages/design-tokens/src: it copies that
// directory to a temporary one, replaces the single hex definition of orange600 (the product
// primary, themes.light.primary; today in primitives.ts) with a sentinel in the copy, and runs
// Vitest with `@gb-locacoes/design-tokens` aliased to the copy and EXPECT_PRIMARY set to the
// sentinel. The sha256 of tokens.ts and of the whole source tree are taken before and after and
// must be identical.
//
// Levels:
//   1. style resolution — packages/ui/src/native/Button.native.test.tsx (react-native replaced by
//      recording host components) and packages/ui/src/web/Button.web.test.tsx under
//      vitest.platform.config.ts. Each platform is reported separately. The web Button draws its
//      colors from literal Tailwind classes in packages/ui/src/contract/button.ts, so the web
//      level reports "não propagado" with that reason until it reads the token.
//   2. web render    — not run: `next build` would need a bundler alias to the temporary copy
//      (apps/clients/web/next.config.mjs has none), and level 1 already shows the web Button
//      does not consume the token, so the prerendered HTML could not carry the sentinel.
//   3. mobile export — not run: `expo export` would need a Metro alias to the temporary copy
//      (apps/clients/mobile/metro.config.js has none). Rewriting tokens.ts in place for it was
//      removed on purpose (shared checkout; a crash left the sentinel in the canonical file).
//   Native runtime on a device or emulator is not covered.
//
// Verdict: tools/token-propagation-expectations.json lists, with a reason, the propagation levels that
// are not proven yet. Every level is reported as it is. The exit code is 0 only when the state matches
// that list: a level outside the list that is not proven fails (regression); a level in the list that
// became proven also fails, so the list has to be updated when a level is fixed (it can only shrink
// honestly). Integrity checks (tokens.ts and the source tree unchanged, the alias applied, no other
// failing assertion) can never be listed: they always have to pass.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Levels that measure propagation; only these may be listed as not proven yet. */
export const PROPAGATION_LEVELS = ["style resolution (native)", "style resolution (web)", "web render", "mobile export"];
export const EXPECTATIONS_FILE = "tools/token-propagation-expectations.json";

/** Validates the expectations file body; returns the not-proven map and the problems found. */
export function readExpectations(text) {
  const problems = [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { notProven: {}, problems: [`${EXPECTATIONS_FILE} is not valid JSON: ${error.message}`] };
  }
  const notProven = {};
  const listed = data?.notProven;
  if (!listed || typeof listed !== "object" || Array.isArray(listed)) problems.push(`${EXPECTATIONS_FILE}: expected an object "notProven": { "<level>": "<reason>" }`);
  for (const [level, reason] of Object.entries(listed ?? {})) {
    if (!PROPAGATION_LEVELS.includes(level)) problems.push(`${EXPECTATIONS_FILE}: "${level}" is not a propagation level (${PROPAGATION_LEVELS.join(", ")}); integrity checks can never be expected to fail`);
    else if (typeof reason !== "string" || reason.trim().length < 8) problems.push(`${EXPECTATIONS_FILE}: "${level}" needs a reason (8+ characters)`);
    else notProven[level] = reason.trim();
  }
  return { notProven, problems };
}

/**
 * Compares the measured levels ([name, proven]) with the expectation. Each verdict is "ok", "expected"
 * (not proven and listed), "regression" (not proven and not listed) or "unexpected pass" (proven but listed).
 */
export function judgeLevels(levels, notProven) {
  const verdicts = levels.map(([name, proven]) => {
    const listed = Object.hasOwn(notProven, name);
    const verdict = proven ? (listed ? "unexpected pass" : "ok") : listed ? "expected" : "regression";
    return { name, proven: Boolean(proven), verdict, ...(listed ? { reason: notProven[name] } : {}) };
  });
  const measured = new Set(levels.map(([name]) => name));
  const unknown = Object.keys(notProven).filter((name) => !measured.has(name));
  return { verdicts, unknown, ok: unknown.length === 0 && verdicts.every((entry) => entry.verdict === "ok" || entry.verdict === "expected") };
}

const LABEL = { ok: "ok          ", expected: "NOT PROVEN  ", regression: "REGRESSION  ", "unexpected pass": "NOW PROVEN  " };

async function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const tokensDir = path.join(root, "packages", "design-tokens", "src");
  const tokensFile = path.join(tokensDir, "tokens.ts");
  const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const toPosix = (p) => p.split(path.sep).join("/");
  const filesUnder = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name)).sort();
  /** One hash over every file of the canonical source (relative path + content). */
  const treeHash = () => {
    const h = createHash("sha256");
    for (const f of filesUnder(tokensDir)) h.update(`${toPosix(path.relative(tokensDir, f))}\0`).update(fs.readFileSync(f)).update("\0");
    return h.digest("hex");
  };
  const tests = {
    web: "packages/ui/src/web/Button.web.test.tsx",
    native: "packages/ui/src/native/Button.native.test.tsx",
  };
  const sentinel = "#12A457";
  const DEFINITION = /\borange600:\s*"(#[0-9A-Fa-f]{6})"/g;

  const expectationsPath = path.join(root, EXPECTATIONS_FILE);
  const expectations = fs.existsSync(expectationsPath) ? readExpectations(fs.readFileSync(expectationsPath, "utf8")) : { notProven: {}, problems: [`${EXPECTATIONS_FILE} not found`] };

  const before = sha256(tokensFile);
  const treeBefore = treeHash();
  // The hex may live in tokens.ts or in a lower level (primitives.ts); exactly one definition.
  const definitions = filesUnder(tokensDir)
    .filter((f) => /\.tsx?$/.test(f) && !/[\\/]__tests__[\\/]|\.test\.tsx?$/.test(f))
    .flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(DEFINITION)].map((m) => ({ file: f, text: m[0], value: m[1] })));
  if (definitions.length !== 1) throw new Error(`expected one hex definition of orange600 in ${toPosix(path.relative(root, tokensDir))}, found ${definitions.length}`);
  const [definition] = definitions;
  const previous = definition.value;

  const result = {
    sentinel,
    token: "orange600 -> themes.light.primary",
    definedIn: toPosix(path.relative(root, definition.file)),
    previous,
    tokensFile: { path: toPosix(path.relative(root, tokensFile)), sha256Before: before, sha256After: null, unchanged: null },
    tokenSourceTree: { path: toPosix(path.relative(root, tokensDir)), sha256Before: treeBefore, sha256After: null, unchanged: null },
    styleResolution: null,
    webRender: {
      checked: false,
      propagated: false,
      reason: "não executado: next build só veria a cópia temporária com um alias de bundler (apps/clients/web/next.config.mjs não tem), e a resolução de estilo acima mostra que o Button.web não consome o token",
    },
    mobileExport: {
      checked: false,
      propagated: false,
      reason: "não executado: expo export só veria a cópia temporária com um alias do Metro (apps/clients/mobile/metro.config.js não tem); reescrever tokens.ts no lugar foi removido",
    },
    nativeRuntime: "not covered by this script",
    expectations: null,
  };

  /** First line of a Vitest failure, without the error class and the expected/received dump. */
  const reasonOf = (messages) => {
    const first = String(messages?.[0] ?? "").split("\n")[0].replace(/^\w*Error:\s*/, "");
    const cut = first.indexOf(": expected ");
    return cut === -1 ? first : first.slice(0, cut);
  };

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "token-propagation-"));
  const previousExpect = process.env.EXPECT_PRIMARY;
  try {
    const copy = path.join(temporary, "design-tokens");
    fs.cpSync(tokensDir, copy, { recursive: true });
    const copied = path.join(copy, path.relative(tokensDir, definition.file));
    const original = fs.readFileSync(copied, "utf8");
    const replaced = original.replace(definition.text, definition.text.replace(previous, sentinel));
    if (replaced === original) throw new Error("sentinel substitution changed nothing");
    fs.writeFileSync(copied, replaced);
    const resultsFile = path.join(temporary, "vitest.json");

    const { startVitest } = await import("vitest/node");
    process.env.EXPECT_PRIMARY = sentinel;
    await startVitest(
      "test",
      [tests.web, tests.native],
      { root, config: path.join(root, "vitest.platform.config.ts"), run: true, watch: false, reporters: ["default", "json"], outputFile: { json: resultsFile } },
      { resolve: { alias: [{ find: /^@gb-locacoes\/design-tokens$/, replacement: toPosix(path.join(copy, "index.ts")) }] } },
    );

    const report = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, "utf8")) : { testResults: [] };
    const assertions = (test) => report.testResults.filter((f) => toPosix(f.name).endsWith(test)).flatMap((f) => f.assertionResults);
    const failing = (list) => list.filter((a) => a.status === "failed");

    const web = assertions(tests.web);
    const native = assertions(tests.native);
    const aliasTest = web.find((a) => /carries the sentinel/.test(a.title));
    const webTest = web.find((a) => /renders the primary token value/.test(a.title));
    const nativeTest = native.find((a) => /gradient variant background from the primary token/.test(a.title));
    const aliasApplied = aliasTest?.status === "passed";

    result.styleResolution = {
      aliasApplied,
      native: nativeTest
        ? { propagated: nativeTest.status === "passed", test: nativeTest.fullName, ...(nativeTest.status === "passed" ? {} : { reason: reasonOf(nativeTest.failureMessages) }) }
        : { propagated: false, reason: `teste de propagação não encontrado em ${tests.native}` },
      web: webTest
        ? { propagated: webTest.status === "passed", test: webTest.fullName, ...(webTest.status === "passed" ? {} : { reason: reasonOf(webTest.failureMessages) }) }
        : { propagated: false, reason: `teste de propagação não encontrado em ${tests.web}` },
      // Any other failure (existing assertions) means the run itself is not trustworthy.
      otherFailures: failing([...web, ...native])
        .filter((a) => a !== webTest && a !== nativeTest)
        .map((a) => ({ test: a.fullName, reason: reasonOf(a.failureMessages) })),
    };
    if (!aliasApplied) result.styleResolution.aliasReason = aliasTest ? reasonOf(aliasTest.failureMessages) : "teste do alias não executado";
  } finally {
    if (previousExpect === undefined) delete process.env.EXPECT_PRIMARY;
    else process.env.EXPECT_PRIMARY = previousExpect;
    fs.rmSync(temporary, { recursive: true, force: true });
    result.tokensFile.sha256After = sha256(tokensFile);
    result.tokensFile.unchanged = result.tokensFile.sha256After === before;
    result.tokenSourceTree.sha256After = treeHash();
    result.tokenSourceTree.unchanged = result.tokenSourceTree.sha256After === treeBefore;
  }

  const style = result.styleResolution;
  const levels = [
    ["tokens.ts unchanged", result.tokensFile.unchanged],
    // Another agent may edit the source while this runs; this script only writes the copy.
    ["design-tokens/src unchanged during the run", result.tokenSourceTree.unchanged],
    ["alias to the temporary copy", style?.aliasApplied],
    ["style resolution (native)", style?.native.propagated],
    ["style resolution (web)", style?.web.propagated],
    ["no other failing assertion", style ? style.otherFailures.length === 0 : false],
    ["web render", result.webRender.propagated],
    ["mobile export", result.mobileExport.propagated],
  ];
  const judged = judgeLevels(levels, expectations.notProven);
  result.expectations = { file: EXPECTATIONS_FILE, notProven: expectations.notProven, problems: expectations.problems, unknownLevels: judged.unknown };
  console.log(JSON.stringify(result, null, 2));
  for (const entry of judged.verdicts) console.log(`${LABEL[entry.verdict]} ${entry.name}${entry.verdict === "expected" ? ` (esperado: ${entry.reason})` : ""}`);
  for (const problem of expectations.problems) console.error(problem);
  for (const name of judged.unknown) console.error(`${EXPECTATIONS_FILE}: "${name}" is listed but was not measured`);
  for (const entry of judged.verdicts.filter((item) => item.verdict === "regression")) console.error(`regressão: "${entry.name}" não foi provado e não está em ${EXPECTATIONS_FILE}`);
  for (const entry of judged.verdicts.filter((item) => item.verdict === "unexpected pass")) console.error(`"${entry.name}" passou a ser provado: remova-o de ${EXPECTATIONS_FILE}`);
  // startVitest sets process.exitCode for the expected web failure; the verdict is decided here.
  const ok = judged.ok && expectations.problems.length === 0;
  process.exitCode = ok ? 0 : 1;
  const expected = judged.verdicts.filter((item) => item.verdict === "expected").length;
  console.log(ok ? `token propagation matches ${EXPECTATIONS_FILE} (${expected} level(s) not proven yet, listed with a reason)` : "token propagation does not match the expectation (see above)");
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
const self = fileURLToPath(import.meta.url);
if (process.platform === "win32" ? invoked.toLowerCase() === self.toLowerCase() : invoked === self) await main();
