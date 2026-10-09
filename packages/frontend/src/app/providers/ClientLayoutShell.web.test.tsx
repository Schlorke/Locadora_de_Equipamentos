import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** `from "<módulo>"` com aspas simples ou duplas: a formatação (o Prettier do projeto usa simples) não muda o import. */
const importsFrom = (specifier: string) =>
  new RegExp(`\\bfrom\\s*(["'])${specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\1`);

describe("ClientLayoutShell", () => {
  const source = readFileSync(
    new URL("./ClientLayoutShell.web.tsx", import.meta.url),
    "utf8",
  );
  const host = readFileSync(
    new URL("../../../../../app/ClientLayout.tsx", import.meta.url),
    "utf8",
  );
  const appIndex = readFileSync(
    new URL("../index.web.ts", import.meta.url),
    "utf8",
  );

  it("compõe chrome público e exporta pelo app entry", () => {
    expect(source).toMatch(importsFrom("../../widgets/cabecalho"));
    expect(source).toMatch(importsFrom("../../widgets/rodape"));
    expect(source).toMatch(importsFrom("../../widgets/whatsapp-flutuante"));
    expect(source).toMatch(importsFrom("@gb-locacoes/ui"));
    expect(source).toContain("Toaster");
    expect(source).toContain("pt-[calc(env(safe-area-inset-top,0px)+var(--header-offset))]");
    expect(source).toContain("#334155");
    expect(source).toContain("publicExtras");
    expect(source).toContain("hostExtras");
    expect(appIndex).toContain("ClientLayoutShell");
  });

  it("preserva supressão Three.js / WebGL e não traz Prisma nem scroll-reveal", () => {
    expect(source).toContain("three");
    expect(source).toContain("clock");
    expect(source).toContain("webglrenderer");
    expect(source).toContain("context lost");
    expect(source).not.toMatch(/prisma/i);
    expect(source).not.toContain("scroll-reveal-init");
    expect(source).not.toContain("equipment-3d-carousel");
    expect(source).not.toContain("model-viewer");
    expect(source).not.toContain("lazy-3d-carousel");
  });

  it("host fica shell fino com scroll-reveal-init e service worker", () => {
    expect(host).toContain("@gb-locacoes/frontend/app");
    expect(host).toContain("ClientLayoutShell");
    expect(host).toContain("./scroll-reveal-init");
    expect(host).toContain("ServiceWorkerRegister");
    expect(host).not.toContain("widgets/cabecalho");
    expect(host).not.toContain("widgets/rodape");
    expect(host).not.toContain("WhatsAppFAB");
    expect(host).not.toContain("Toaster");
    expect(host).not.toMatch(/prisma/i);
  });

  // Onda 135 (A8; E8 do plano de aposentadoria da raiz): a mesma prova sobre os providers do host web, que montam a
  // moldura no lugar do app/ClientLayout.tsx da raiz. O ScrollRevealInit (sincroniza o carrossel 3D) vai pelos
  // `publicExtras`, carregado sob demanda; o host web não registra service worker (M4 do plano).
  it.each([
    "apps/clients/web/src/host/providers/TenantSiteProviders.tsx",
    "apps/clients/web/src/host/providers/AppHostProviders.tsx",
  ])("host web %s fica fino com o ScrollRevealInit nos publicExtras", (file) => {
    const web = readFileSync(new URL(`../../../../../${file}`, import.meta.url), "utf8");
    expect(web).toMatch(importsFrom("@gb-locacoes/frontend/app"));
    expect(web).toMatch(/<ClientLayoutShell\b[^>]*\bpublicExtras=\{<ScrollRevealInit \/>\}/);
    expect(web).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']@gb-locacoes\/frontend\/app["']\)\.then\(\(module\) => module\.ScrollRevealInit\)/);
    expect(web).toMatch(/ssr:\s*false/);
    expect(web).not.toContain("ServiceWorkerRegister");
    expect(web).not.toContain("widgets/cabecalho");
    expect(web).not.toContain("widgets/rodape");
    expect(web).not.toContain("WhatsAppFAB");
    expect(web).not.toContain("Toaster");
    expect(web).not.toMatch(/prisma/i);
  });
});
