// @vitest-environment jsdom
// Layout raiz REAL do app (./_layout) com o portão de área privada. O core de navegação e o StackRouter são os do
// expo-router instalado; só o <Stack/> nativo (react-native-screens, que não roda fora do dispositivo) vira um navegador
// de pilha mínimo sobre esse core, que recebe as MESMAS props do layout (screenLayout, screenOptions) e registra as
// telas da árvore real de src/app com os nomes que o expo-router usa. A URL de cada tela sai do construtor de rotas do
// expo-router, não do layout: se o layout perder `screenLayout={gatedScreen}` ou mapear mal o nome da rota, os testes
// falham. Módulos nativos (auth, armazenamento, links, ações do aparelho) são trocados por dublês mínimos.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { useEffect, useSyncExternalStore, type ComponentType, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from "expo-router/build/react-navigation/core";
import { StackRouter } from "expo-router/build/react-navigation/routers";
import { getRoutes } from "expo-router/build/getRoutesCore";
import { stripGroupSegmentsFromPath } from "expo-router/build/matchers";
// @ts-expect-error -- módulo CommonJS interno do expo-router sem declaração de tipos; é o filtro real do require.context.
import { EXPO_ROUTER_CTX_IGNORE } from "expo-router/_ctx-shared";
import type { SessionSnapshot, TenantContext } from "@gb-locacoes/frontend/app";

type SessionFn = () => Promise<SessionSnapshot>;
const host = vi.hoisted(() => ({
  expoRouter: {} as Record<"Stack" | "useRouter" | "usePathname" | "useGlobalSearchParams", (...args: never[]) => unknown>,
  getSession: (async () => null) as SessionFn,
  storage: new Map<string, string>(),
}));
vi.mock("expo-router", () => ({
  Stack: (props: never) => host.expoRouter.Stack(props),
  useRouter: () => host.expoRouter.useRouter(),
  usePathname: () => host.expoRouter.usePathname(),
  useGlobalSearchParams: () => host.expoRouter.useGlobalSearchParams(),
}));
vi.mock("expo-linking", () => ({ openURL: async () => true }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => host.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { host.storage.set(key, value); },
    removeItem: async (key: string) => { host.storage.delete(key); },
  },
}));
vi.mock("../host/device", () => ({ deviceActions: {} }));
vi.mock("../host/auth/client", () => ({
  authMode: "legacy",
  apiBaseUrl: "https://api.example.test",
  hostAuth: { getSession: () => host.getSession(), signOut: async () => undefined, getApiHeaders: async () => ({}) },
}));

import RootLayout from "./_layout";

// ---- Árvore real de src/app, como o require.context do Metro a vê (mesmo filtro e mesma blockList). ----
const appDir = import.meta.dirname;
const metroBlockList: RegExp[] = [createRequire(import.meta.url)("../../metro.config.js").resolver.blockList].flat();
function contextKeys(dir: string, prefix = "."): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? contextKeys(dir + "/" + entry.name, prefix + "/" + entry.name) : [prefix + "/" + entry.name],
  );
}
const keys = contextKeys(appDir).filter((key) => EXPO_ROUTER_CTX_IGNORE.test(key) && !metroBlockList.some((pattern) => pattern.test(join(appDir, key))));
const context = Object.assign(() => ({ default: () => null }), { keys: () => keys, resolve: (key: string) => key, id: "app" });
type RouteNode = { type: string; route: string; contextKey: string };
const tree = getRoutes(context as never, {
  platform: "android",
  ignoreEntryPoints: true,
  getSystemRoute: ({ route, type }: { route: string; type: string }) => ({ type, route, contextKey: "system:" + route, children: [], dynamic: null, loadRoute: () => ({}) }) as never,
}) as unknown as { children: RouteNode[] };
const routeNames = tree.children.filter((node) => node.type === "route" && !node.contextKey.startsWith("system:")).map((node) => node.route);
const urlOf = (routeName: string) => "/" + stripGroupSegmentsFromPath(routeName).replace(/(^|\/)index$/, "");
const nameOf = (url: string) => {
  const name = routeNames.find((route) => urlOf(route) === url);
  if (!name) throw new Error("Nenhuma tela do app responde por " + url);
  return name;
};

// ---- Estado do "roteador": caminho da tela focada e parâmetros globais, como o expo-router expõe. ----
type NavState = { index: number; routes: Array<{ key: string; name: string; state?: NavState }> };
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) { value = next; listeners.forEach((listener) => listener()); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
const pathname = createStore("/");
const params = createStore<{ tenantSlug?: string }>({});
const navigationRef = createNavigationContainerRef();
const navigateTo = (routeName: string) => (navigationRef as unknown as { navigate(name: string, params?: object): void }).navigate("__root", { screen: routeName });
function focusedRouteName(state: NavState | undefined): string | null {
  let current = state, name: string | null = null;
  while (current) {
    const route = current.routes[current.index];
    if (!route) break;
    name = route.name;
    current = route.state;
  }
  return name;
}
/** Hrefs que chegaram ao roteador (já resolvidos pelo layout), na ordem. */
const pushed: string[] = [];
function push(href: string) {
  pushed.push(href);
  const url = new URL(href, "http://app.invalid");
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (tenantSlug) params.set({ ...params.get(), tenantSlug });
  navigateTo(nameOf(url.pathname));
}
const router = { push, replace: push, back: () => navigationRef.goBack(), setParams: (next: { tenantSlug?: string }) => params.set({ ...params.get(), ...next }) };

// ---- <Stack/>: navegador de pilha mínimo sobre o core real; renderiza todas as telas da pilha, como o Stack. ----
const stackLife = { mounts: 0, unmounts: 0 };
const screenMounts: Record<string, number> = {};
function PilhaNavigator(props: Record<string, unknown>) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, props as never) as unknown as {
    state: NavState;
    descriptors: Record<string, { render(): ReactNode }>;
    NavigationContent: (p: { children: ReactNode }) => ReactElement;
  };
  useEffect(() => {
    stackLife.mounts += 1;
    return () => { stackLife.unmounts += 1; };
  }, []);
  return <NavigationContent>{state.routes.map((route) => <section key={route.key} data-route={route.name}>{descriptors[route.key]!.render()}</section>)}</NavigationContent>;
}
const Pilha = createNavigatorFactory(PilhaNavigator)();
const RootNavigator = createNavigatorFactory(PilhaNavigator)();
const screens: Record<string, ComponentType> = Object.fromEntries(routeNames.map((routeName) => [routeName, function Tela() {
  useEffect(() => { screenMounts[routeName] = (screenMounts[routeName] ?? 0) + 1; }, []);
  return <p>{"Tela " + urlOf(routeName)}</p>;
}]));
let initialRoute = nameOf("/");
host.expoRouter.Stack = ((props: Record<string, unknown>) => (
  <Pilha.Navigator {...props} initialRouteName={initialRoute}>
    {routeNames.map((routeName) => <Pilha.Screen key={routeName} name={routeName} component={screens[routeName]!} />)}
  </Pilha.Navigator>
)) as never;
host.expoRouter.useRouter = (() => router) as never;
host.expoRouter.usePathname = (() => useSyncExternalStore(pathname.subscribe, pathname.get)) as never;
host.expoRouter.useGlobalSearchParams = (() => useSyncExternalStore(params.subscribe, params.get)) as never;

function renderApp({ session, memberships, selection, tenantSlug, at = "/" }: { session: SessionSnapshot; memberships: TenantContext[]; selection: TenantContext | null; tenantSlug?: string; at?: string }) {
  host.getSession = async () => session;
  let current = selection;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const path = new URL(input).pathname;
    if (path === "/api/auth/organizations") return Response.json({ memberships });
    if (init?.method === "POST") {
      const { tenantId } = JSON.parse(String(init.body)) as { tenantId: string };
      current = memberships.find((item) => item.tenant.id === tenantId) ?? null;
    }
    return Response.json({ selection: current });
  }));
  initialRoute = nameOf(at);
  pathname.set(at);
  params.set(tenantSlug ? { tenantSlug } : {});
  return render(
    <BaseNavigationContainer ref={navigationRef} onStateChange={(state: unknown) => { pathname.set(urlOf(focusedRouteName(state as NavState) ?? initialRoute)); }}>
      <RootNavigator.Navigator>
        <RootNavigator.Screen name="__root" component={RootLayout} />
      </RootNavigator.Navigator>
    </BaseNavigationContainer>,
  );
}

const currentRoute = () => focusedRouteName(navigationRef.getRootState() as unknown as NavState);
const go = (url: string) => act(() => { push(url); });
const section = (url: string) => document.querySelector(`[data-route="${nameOf(url)}"]`) as HTMLElement | null;
/** A tela mostra o próprio conteúdo, não a espera do portão. */
const showsScreen = (url: string) => { const text = section(url)?.textContent ?? ""; return text.includes("Tela " + url) && !text.includes("Carregando..."); };
const ana = { user: { id: "user-1", name: "Ana" }, expires: "2099-01-01T00:00:00.000Z" };
const membership = (slug: string, role: TenantContext["role"] = "ADMIN"): TenantContext => ({ tenant: { id: "t-" + slug, slug, name: "Locadora " + slug.toUpperCase(), status: "ACTIVE" }, membershipId: "m-" + slug, role });

beforeEach(() => {
  window.localStorage.clear();
  host.storage.clear();
  pushed.length = 0;
  stackLife.mounts = 0;
  stackLife.unmounts = 0;
  for (const key of Object.keys(screenMounts)) delete screenMounts[key];
  // Radix Select (seletor de locadora) no jsdom.
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("_layout do app: portão de área privada por tela no Stack do Expo Router", () => {
  it("a árvore real tem as telas usadas aqui e as privadas são as do host", () => {
    for (const url of ["/", "/equipamentos", "/login", "/admin/dashboard", "/area-cliente"]) expect(routeNames).toContain(nameOf(url));
  });

  it("entrar em rota privada com troca de escopo do carrinho mantém a rota e o Stack montado", async () => {
    // Seleção restaurada pelo servidor (locadora-a) e app aberto em "/" sem slug público: o escopo muda ao entrar na área.
    renderApp({ session: ana, memberships: [membership("locadora-a")], selection: membership("locadora-a") });
    expect(await screen.findByText("Tela /")).toBeTruthy();

    go("/admin/dashboard");
    expect(await screen.findByText("Tela /admin/dashboard")).toBeTruthy();
    expect(currentRoute()).toBe(nameOf("/admin/dashboard"));
    expect(pathname.get()).toBe("/admin/dashboard");
    // A tela de fundo (pública) continua na pilha e o navegador nunca remontou.
    expect(screen.getByText("Tela /")).toBeTruthy();
    expect(stackLife).toEqual({ mounts: 2, unmounts: 0 }); // "__root" + Stack do layout
  });

  it("sem sessão em tela privada, o portão cobre a tela e 'Entrar' navega para o login pelo layout, com retorno para a tela", async () => {
    renderApp({ session: null, memberships: [], selection: null, tenantSlug: "locadora-a", at: "/area-cliente" });
    const entrar = await screen.findByRole("button", { name: "Entrar" });
    expect(section("/area-cliente")!.contains(entrar)).toBe(true);
    expect(screen.queryByText("Tela /area-cliente")).toBeNull();

    fireEvent.click(entrar);
    await waitFor(() => expect(currentRoute()).toBe(nameOf("/login")));
    expect(await screen.findByText("Tela /login")).toBeTruthy();
    // O caminho da tela focada volta como callbackUrl (a tela de login do app o lê de useLocalSearchParams).
    const login = new URL(pushed.at(-1)!, "http://app.invalid");
    expect(login.pathname).toBe("/login");
    expect(login.searchParams.get("callbackUrl")).toBe("/area-cliente");
    expect(login.searchParams.get("tenantSlug")).toBe("locadora-a");
    expect(params.get().tenantSlug).toBe("locadora-a");
    expect(stackLife.unmounts).toBe(0);
  });

  it("sem locadora selecionada, o seletor aparece dentro da tela privada e a escolha abre a área na mesma rota", async () => {
    renderApp({ session: ana, memberships: [membership("locadora-a", "CLIENT"), membership("locadora-b", "CLIENT")], selection: null });
    expect(await screen.findByText("Tela /")).toBeTruthy();

    go("/area-cliente");
    const trigger = await screen.findByRole("combobox");
    expect(currentRoute()).toBe(nameOf("/area-cliente"));
    expect(section("/area-cliente")!.contains(trigger)).toBe(true);
    expect(screen.queryByText("Tela /area-cliente")).toBeNull();

    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Locadora LOCADORA-B" }));
    expect(await screen.findByText("Tela /area-cliente")).toBeTruthy();
    expect(currentRoute()).toBe(nameOf("/area-cliente"));
    // O layout guarda a locadora escolhida como slug público (parâmetro global e armazenamento do aparelho).
    await waitFor(() => expect(params.get().tenantSlug).toBe("locadora-b"));
    expect(host.storage.get("public-tenant-slug")).toBe("locadora-b");
    expect(stackLife.unmounts).toBe(0);
  });

  it("tela privada aberta continua montada na ida à vitrine e na volta, apesar das trocas de escopo do carrinho", async () => {
    renderApp({ session: ana, memberships: [membership("locadora-b", "CLIENT")], selection: membership("locadora-b", "CLIENT"), tenantSlug: "locadora-a" });
    expect(await screen.findByText("Tela /")).toBeTruthy();
    go("/area-cliente");
    expect(await screen.findByText("Tela /area-cliente")).toBeTruthy();
    expect(screenMounts[nameOf("/area-cliente")]).toBe(1);

    // Vitrine por cima (escopo da locadora pública): a tela da área fica na pilha, aberta.
    go("/equipamentos");
    expect(await screen.findByText("Tela /equipamentos")).toBeTruthy();
    expect(pathname.get()).toBe("/equipamentos");
    expect(showsScreen("/area-cliente")).toBe(true);

    // Volta (escopo da locadora selecionada de novo): nada de espera nem remontagem da tela.
    act(() => { router.back(); });
    expect(pathname.get()).toBe("/area-cliente");
    expect(showsScreen("/area-cliente")).toBe(true);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(showsScreen("/area-cliente")).toBe(true);
    expect(screenMounts[nameOf("/area-cliente")]).toBe(1);
    expect(stackLife.unmounts).toBe(0);
  });
});
