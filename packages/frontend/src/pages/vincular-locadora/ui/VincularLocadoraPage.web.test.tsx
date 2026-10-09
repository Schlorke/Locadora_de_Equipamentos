// @vitest-environment jsdom
// Tela de vínculo com a locadora do host (ADR adr-tenant-hosts D9): consentimento explícito, POST só com
// `{ consent: true }` (a locadora vem do host) e nada a fazer quando já vinculado, suspenso ou revogado.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "../../../entities/organizacao";
import { ApplicationSessionProvider, type SessionState } from "../../../entities/sessao";
import { ApiClientProvider, HttpError, type HttpClient } from "../../../shared/api";
import { VincularLocadoraPage } from "./VincularLocadoraPage.web";

const clienteA: TenantContext = { tenant: { id: "t-a", slug: "locadora-a", name: "Locadora A", status: "ACTIVE" }, membershipId: "m-a", role: "CLIENT" };

type Call = { path: string; method: string; body?: string };
function api({ current, enroll }: { current: () => TenantContext | number; enroll?: () => number }) {
  const calls: Call[] = [];
  const client: HttpClient = {
    async request<T>(path: string, options: { method?: string; body?: string } = {}) {
      calls.push({ path, method: options.method ?? "GET", body: options.body });
      if (path === "/api/auth/organizations/current") {
        const result = current();
        if (typeof result === "number") throw new HttpError("falha", result);
        return { membership: result } as T;
      }
      if (path === "/api/client/enroll") {
        const status = enroll?.() ?? 201;
        if (status >= 400) throw new HttpError("Não foi possível concluir o vínculo. Fale com a locadora.", status);
        return { membership: clienteA, created: true } as T;
      }
      throw new Error("rota inesperada " + path);
    },
  };
  return { client, calls };
}

function renderPage(client: HttpClient, status: SessionState["status"] = "authenticated") {
  const session: SessionState = {
    data: status === "authenticated" ? { user: { id: "user-1", name: "Ana" } } : null,
    status,
    update: vi.fn(async () => null),
    signOut: vi.fn(async () => undefined),
  };
  render(
    <ApplicationSessionProvider value={session}>
      <ApiClientProvider client={client}>
        <VincularLocadoraPage tenantName="Locadora A" />
      </ApiClientProvider>
    </ApplicationSessionProvider>
  );
  return session;
}

// O checkbox (Radix) mede o próprio tamanho; o jsdom não tem ResizeObserver.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => vi.unstubAllGlobals());
afterEach(() => cleanup());

describe("VincularLocadoraPage (web)", () => {
  it("sem sessão pede login e volta para /vincular, sem consultar a API", () => {
    const { client, calls } = api({ current: () => 404 });
    renderPage(client, "unauthenticated");
    expect(screen.getByText("Entre na sua conta para vincular seu cadastro a Locadora A.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/login?callbackUrl=%2Fvincular");
    expect(calls).toEqual([]);
  });

  it("vincula só com consentimento marcado e envia apenas { consent: true }", async () => {
    const { client, calls } = api({ current: () => 404 });
    const session = renderPage(client);
    const submit = await screen.findByRole("button", { name: "Vincular minha conta" });
    expect(screen.getByText(/Locadora A passa a ver os dados do seu cadastro/)).toBeTruthy();
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox"));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(submit); });

    expect(await screen.findByText("Pronto! Sua conta está vinculada a Locadora A.")).toBeTruthy();
    expect(calls.filter((call) => call.method === "POST")).toEqual([{ path: "/api/client/enroll", method: "POST", body: JSON.stringify({ consent: true }) }]);
    expect(session.update).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Ir para a área do cliente" }).getAttribute("href")).toBe("/area-cliente");
  });

  it("recusa do servidor mantém o formulário com a mensagem", async () => {
    const { client } = api({ current: () => 404, enroll: () => 409 });
    renderPage(client);
    const submit = await screen.findByRole("button", { name: "Vincular minha conta" });
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => { fireEvent.click(submit); });
    expect(await screen.findByText("Não foi possível concluir o vínculo. Fale com a locadora.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vincular minha conta" })).toBeTruthy();
  });

  it("já vinculado: nada a vincular", async () => {
    const { client, calls } = api({ current: () => clienteA });
    renderPage(client);
    expect(await screen.findByText("Sua conta já está vinculada a Locadora A.")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("vínculo suspenso ou revogado não é reativado pela tela", async () => {
    const { client, calls } = api({ current: () => 403 });
    renderPage(client);
    expect(await screen.findByText("Seu vínculo com Locadora A está suspenso ou foi encerrado. Fale com a locadora.")).toBeTruthy();
    await waitFor(() => expect(calls.length).toBe(1));
    expect(screen.queryByRole("button", { name: "Vincular minha conta" })).toBeNull();
  });
});
