import { describe, expect, it, vi } from "vitest";
import { createLegacyAuthClient } from "./legacy-client";

type Reply = { status?: number; body: unknown };
function fakeFetch(replies: Record<string, Reply>) {
  return vi.fn(async (input: unknown, _init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const reply = replies[path];
    if (!reply) throw new Error("rota inesperada " + path);
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
}
const bodyOf = (init?: RequestInit) => new URLSearchParams(String(init?.body));

describe("createLegacyAuthClient", () => {
  it("exige a URL da API antes de qualquer requisição", async () => {
    const fetcher = fakeFetch({});
    await expect(createLegacyAuthClient(undefined, fetcher).getSession()).rejects.toThrow("Configure EXPO_PUBLIC_API_URL");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("lê a sessão com cookies incluídos e sem barra duplicada", async () => {
    const fetcher = fakeFetch({ "/api/auth/session": { body: { user: { id: "u1", email: "pessoa@example.test" } } } });
    const session = await createLegacyAuthClient("https://api.example.test/", fetcher).getSession();
    expect(session?.user?.id).toBe("u1");
    expect(fetcher).toHaveBeenCalledWith("https://api.example.test/api/auth/session", expect.objectContaining({ credentials: "include" }));
  });

  it("sessão vazia vira null e resposta de erro falha", async () => {
    expect(await createLegacyAuthClient("https://api.example.test", fakeFetch({ "/api/auth/session": { body: {} } })).getSession()).toBeNull();
    await expect(createLegacyAuthClient("https://api.example.test", fakeFetch({ "/api/auth/session": { status: 500, body: {} } })).getSession()).rejects.toThrow("Não foi possível acessar a sessão.");
  });

  it("login por credenciais envia csrf e interpreta o erro do callback", async () => {
    const ok = fakeFetch({
      "/api/auth/csrf": { body: { csrfToken: "csrf-1" } },
      "/api/auth/callback/credentials": { body: { url: "https://api.example.test/" } },
    });
    expect(await createLegacyAuthClient("https://api.example.test", ok).signInCredentials("pessoa@example.test", "segredo-teste")).toEqual({ ok: true, error: null });
    const [, init] = ok.mock.calls[1]!;
    expect(init?.method).toBe("POST");
    expect(bodyOf(init).get("csrfToken")).toBe("csrf-1");
    expect(bodyOf(init).get("email")).toBe("pessoa@example.test");
    expect(bodyOf(init).get("json")).toBe("true");

    const denied = fakeFetch({
      "/api/auth/csrf": { body: { csrfToken: "csrf-2" } },
      "/api/auth/callback/credentials": { status: 401, body: { url: "https://api.example.test/login?error=CredentialsSignin" } },
    });
    expect(await createLegacyAuthClient("https://api.example.test", denied).signInCredentials("pessoa@example.test", "errada")).toEqual({ ok: false, error: "CredentialsSignin" });
  });

  it("não tenta login sem token csrf", async () => {
    const fetcher = fakeFetch({ "/api/auth/csrf": { body: {} } });
    await expect(createLegacyAuthClient("https://api.example.test", fetcher).signInCredentials("a@example.test", "x")).rejects.toThrow("Não foi possível iniciar a autenticação.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("logout envia o token csrf", async () => {
    const fetcher = fakeFetch({ "/api/auth/csrf": { body: { csrfToken: "csrf-3" } }, "/api/auth/signout": { body: {} } });
    await createLegacyAuthClient("https://api.example.test", fetcher).signOut();
    const [url, init] = fetcher.mock.calls[1]!;
    expect(url).toBe("https://api.example.test/api/auth/signout");
    expect(bodyOf(init).get("csrfToken")).toBe("csrf-3");
  });
});
