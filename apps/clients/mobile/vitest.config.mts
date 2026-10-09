// Testes do host Expo: adaptadores (src/host) e o layout raiz real (src/app/_layout.test.tsx). Rodam em Node ou
// jsdom com mocks mínimos dos módulos nativos; não substituem execução em dispositivo. Testes em src/app ficam fora
// do mapa de arquivos do Metro (blockList em metro.config.js), então o expo-router não os trata como telas.
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["src/host/**/*.test.{ts,tsx}", "src/app/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
