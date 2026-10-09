interface LegacySession { user?: { id?: string; email?: string | null; role?: string | null; name?: string | null } }

export function createLegacyAuthClient(baseUrl: string | undefined, fetcher: typeof fetch = fetch) {
  const base = baseUrl?.replace(/\/$/, "") || "";
  async function request(path: string, init?: RequestInit) {
    if (!base) throw new Error("Configure EXPO_PUBLIC_API_URL para conectar o aplicativo.");
    const response = await fetcher(base + "/api/auth" + path, { ...init, credentials: "include" });
    const data = await response.json();
    if (!response.ok && !path.startsWith("/callback/")) throw new Error("Não foi possível acessar a sessão.");
    return { response, data };
  }
  return {
    async getSession(): Promise<LegacySession | null> {
      const { data } = await request("/session");
      return data?.user ? data : null;
    },
    async signInCredentials(email: string, password: string) {
      const { data: csrf } = await request("/csrf");
      if (typeof csrf?.csrfToken !== "string") throw new Error("Não foi possível iniciar a autenticação.");
      const { response, data } = await request("/callback/credentials", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl: base, json: "true" }).toString(),
      });
      const error = typeof data?.url === "string" ? new URL(data.url, base).searchParams.get("error") : "CredentialsSignin";
      return { ok: response.ok && !error, error };
    },
    async signOut() {
      const { data: csrf } = await request("/csrf");
      await request("/signout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, json: "true" }).toString() });
    },
  };
}
