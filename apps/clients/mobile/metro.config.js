// Expo detects the pnpm workspace and watches the monorepo root; the `react-native`
// export condition selects @gb-locacoes/ui's native implementation.
const { getDefaultConfig } = require("expo/metro-config");
const fs = require("node:fs");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

/**
 * Testes colocados ao lado das rotas (ex.: src/app/_layout.test.tsx) não são telas. Fora do mapa de arquivos do
 * Metro, o require.context do expo-router não os encontra: não viram rota nem entram no bundle.
 */
const appRouteTests = new RegExp(
  path.join(__dirname, "src", "app").replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&") +
    "[\\\\/].*\\.(test|spec)\\.[cm]?[jt]sx?$",
);
const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaultBlockList) ? defaultBlockList : defaultBlockList ? [defaultBlockList] : []),
  appRouteTests,
];

/**
 * Expo still joins `react-native/rn-get-polyfills`. That file exists on RN 0.86.x
 * (declared by this app) but was removed in 0.87; the workspace may resolve 0.87
 * while 0.86 remains in the pnpm store. Prefer the resolved package, then the
 * store copy — no new install.
 */
function loadRnPolyfills() {
  try {
    const rnRoot = path.dirname(require.resolve("react-native/package.json"));
    const legacy = path.join(rnRoot, "rn-get-polyfills.js");
    if (fs.existsSync(legacy)) {
      return require(legacy)();
    }
  } catch {
    // fall through to store lookup
  }

  try {
    return require("@react-native/js-polyfills")();
  } catch {
    // fall through
  }

  const pnpmStore = path.resolve(__dirname, "../../../node_modules/.pnpm");
  if (fs.existsSync(pnpmStore)) {
    for (const name of fs.readdirSync(pnpmStore)) {
      if (!name.startsWith("react-native@0.86.")) continue;
      const legacy = path.join(
        pnpmStore,
        name,
        "node_modules",
        "react-native",
        "rn-get-polyfills.js",
      );
      if (fs.existsSync(legacy)) {
        return require(legacy)();
      }
    }
  }

  return [];
}

config.serializer = {
  ...config.serializer,
  getPolyfills: () => loadRnPolyfills(),
};

module.exports = config;
