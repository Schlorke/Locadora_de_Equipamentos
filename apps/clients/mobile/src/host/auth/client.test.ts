import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLATFORM } from "@gb-locacoes/contracts/platform";

const native = vi.hoisted(() => {
  const client = {
    getSession: vi.fn(),
    getCookie: vi.fn(),
    signIn: { email: vi.fn(), social: vi.fn() },
    signOut: vi.fn(),
  };
  return {
    client,
    createAuthClient: vi.fn((_options: unknown) => client),
    expoClient: vi.fn((options: unknown) => ({ id: "expo", options })),
    createURL: vi.fn((path: string) => "acme://" + path.replace(/^\//, "")),
    secureStore: { getItem: vi.fn(), setItem: vi.fn() },
    basePath: vi.fn(),
    parseAuthMode: vi.fn(),
  };
});

vi.mock("better-auth/react", () => ({ createAuthClient: native.createAuthClient }));
vi.mock("@better-auth/expo/client", () => ({ expoClient: native.expoClient }));
vi.mock("expo-secure-store", () => native.secureStore);
vi.mock("expo-linking", () => ({ createURL: native.createURL }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { scheme: "acme" } } }));
// Regra única modo → basePath e validação do modo (achado 113): passam pela implementação real do contrato; um caso
// troca a resposta para provar que o cliente a consulta em vez de repetir o mapeamento.
vi.mock("@gb-locacoes/contracts/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gb-locacoes/contracts/platform")>();
  native.basePath.mockImplementation(actual.betterAuthBasePath);
  native.parseAuthMode.mockImplementation(actual.parseAuthMode);
  return { ...actual, betterAuthBasePath: native.basePath, parseAuthMode: native.parseAuthMode };
});

async function loadClient(mode: string | undefined, apiUrl: string | undefined = "https://api.example.test/") {
  vi.resetModules();
  vi.stubEnv("EXPO_PUBLIC_AUTH_MODE", mode);
  vi.stubEnv("EXPO_PUBLIC_API_URL", apiUrl);
  return import("./client");
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hostAuth em modo Better Auth", () => {
  it("encaminha o cookie da sessão nativa no header Cookie das chamadas da API", async () => {
    native.client.getCookie.mockResolvedValue("better-auth.session_token=abc");
    const { hostAuth, authMode, apiBaseUrl } = await loadClient("better-auth");
    expect(authMode).toBe("better-auth");
    expect(apiBaseUrl).toBe("https://api.example.test");
    expect(await hostAuth.getApiHeaders()).toEqual({ Cookie: "better-auth.session_token=abc" });
  });

  it("sem cookie armazenado não inventa header", async () => {
    native.client.getCookie.mockResolvedValue("");
    const { hostAuth } = await loadClient("better-auth");
    expect(await hostAuth.getApiHeaders()).toEqual({});
  });

  it("configura o cliente com a base da versão escolhida e armazenamento seguro", async () => {
    native.client.getCookie.mockResolvedValue(null);
    const v2 = await loadClient("better-auth-v2");
    await v2.hostAuth.getApiHeaders();
    expect(native.createAuthClient).toHaveBeenLastCalledWith(expect.objectContaining({ baseURL: "https://api.example.test/api/auth/v2" }));
    // O servidor nomeia o cookie `<PLATFORM.name>.session_token` (`__Host-` em https); com outro prefixo o expoClient
    // descartaria o Set-Cookie e o login no app não guardaria a sessão.
    expect(native.expoClient).toHaveBeenLastCalledWith({ scheme: "acme", storagePrefix: "gb-locacoes", cookiePrefix: PLATFORM.name, storage: native.secureStore });

    const v1 = await loadClient("better-auth");
    await v1.hostAuth.getApiHeaders();
    expect(native.createAuthClient).toHaveBeenLastCalledWith(expect.objectContaining({ baseURL: "https://api.example.test/api/auth" }));
  });

  it("basePath e modo pela regra única da plataforma (a do host web e do backend), consultada e não repetida", async () => {
    native.client.getCookie.mockResolvedValue(null);
    // Resposta que um mapeamento repetido no app não daria para o modo better-auth.
    native.basePath.mockReturnValueOnce("/api/auth/v2");
    const { hostAuth } = await loadClient("better-auth");
    await hostAuth.getApiHeaders();
    expect(native.parseAuthMode).toHaveBeenCalledWith("better-auth", "EXPO_PUBLIC_AUTH_MODE");
    expect(native.basePath).toHaveBeenCalledWith("better-auth");
    expect(native.createAuthClient).toHaveBeenLastCalledWith(expect.objectContaining({ baseURL: "https://api.example.test/api/auth/v2" }));
  });

  it("login social volta pelo deep link da rota /auth/callback", async () => {
    native.client.signIn.social.mockResolvedValue({ error: null });
    const { hostAuth } = await loadClient("better-auth");
    await hostAuth.signInProvider("google");
    expect(native.createURL).toHaveBeenCalledWith("/auth/callback");
    expect(native.client.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "acme://auth/callback" });
  });

  it("mapeia a sessão e propaga erro do servidor", async () => {
    native.client.getSession.mockResolvedValueOnce({ data: { user: { id: "u1", email: "pessoa@example.test", name: "Pessoa", role: "CLIENT", image: null } }, error: null });
    const { hostAuth } = await loadClient("better-auth");
    expect(await hostAuth.getSession()).toEqual({ user: { id: "u1", email: "pessoa@example.test", name: "Pessoa", role: "CLIENT" } });
    native.client.getSession.mockResolvedValueOnce({ data: null, error: { message: "sessão expirada" } });
    await expect(hostAuth.getSession()).rejects.toThrow("sessão expirada");
  });

  it("sem EXPO_PUBLIC_API_URL não cria cliente", async () => {
    const { hostAuth } = await loadClient("better-auth", "");
    await expect(hostAuth.getApiHeaders()).rejects.toThrow("Configure EXPO_PUBLIC_API_URL");
    expect(native.createAuthClient).not.toHaveBeenCalled();
  });
});

describe("hostAuth em modo legado", () => {
  it("não envia Cookie manual (o fetch nativo usa credentials include) nem cria cliente Better Auth", async () => {
    const { hostAuth, authMode } = await loadClient(undefined);
    expect(authMode).toBe("legacy");
    expect(await hostAuth.getApiHeaders()).toEqual({});
    expect(hostAuth.supportsSocial).toBe(false);
    await expect(hostAuth.signInProvider("google")).rejects.toThrow("Better Auth");
    expect(native.createAuthClient).not.toHaveBeenCalled();
  });

  it("delega a sessão ao cliente legado", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user: { id: "u2", email: "b@example.test" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { hostAuth } = await loadClient("legacy");
    expect((await hostAuth.getSession())?.user?.id).toBe("u2");
    expect(fetcher).toHaveBeenCalledWith("https://api.example.test/api/auth/session", expect.objectContaining({ credentials: "include" }));
  });

  it("recusa modo desconhecido", async () => {
    await expect(loadClient("magic-link")).rejects.toThrow("EXPO_PUBLIC_AUTH_MODE inválido.");
  });
});
