"use client";
import { createAuthClient } from "better-auth/react";
import { getSession, signIn, signOut } from "next-auth/react";
import { betterAuthBasePath } from "@gb-locacoes/contracts/platform";
import { hostAuthMode } from "./mode";

// `process.env.NEXT_PUBLIC_AUTH_MODE` escrito por extenso: é o acesso que o Next embute no bundle do navegador.
const mode = hostAuthMode({ NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE });
// basePath pela regra única modo → basePath (a do proxy, do app mobile e do backend); no legacy este cliente não é usado.
const authClient = createAuthClient({ basePath: betterAuthBasePath(mode) ?? undefined });

export const hostAuth = {
  async getSession() {
    if (mode === "legacy") return getSession();
    const result = await authClient.getSession();
    if (result.error) throw new Error(result.error.message || "Não foi possível acessar a sessão.");
    if (!result.data?.user) return null;
    const user = result.data.user as typeof result.data.user & { role?: string };
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  },
  async signInCredentials(email: string, password: string) {
    if (mode === "legacy") return signIn("credentials", { redirect: false, email, password });
    const result = await authClient.signIn.email({ email, password });
    return { ok: !result.error, error: result.error?.message };
  },
  async signInProvider(provider: "google" | "facebook", callbackUrl = "/auth/callback") {
    if (mode === "legacy") { await signIn(provider, { callbackUrl }); return; }
    const result = await authClient.signIn.social({ provider, callbackURL: callbackUrl });
    if (result.error) throw new Error(result.error.message || "Não foi possível iniciar o login social.");
  },
  async signOut() {
    if (mode === "legacy") { await signOut({ redirect: false }); return; }
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message || "Não foi possível encerrar a sessão.");
  },
};
