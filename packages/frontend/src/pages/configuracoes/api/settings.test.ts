import { describe, expect, it, vi } from "vitest";
import { createHttpClient } from "../../../shared/api/http-client";
import { SettingsSchema } from "../model/settings.schema";
import { createSettingsApi } from "./settings";

describe("API das configurações", () => {
  it("carrega e salva pelo mesmo transporte sem server action do host", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { seoTitle: "GB" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: "Salvo" })));
    const api = createSettingsApi(createHttpClient({ fetcher }));
    await expect(api.getSettings()).resolves.toEqual({ success: true, data: { seoTitle: "GB" } });
    const data = SettingsSchema.parse({ seoTitle: "GB", seoDescription: "Locações", themeColorPrimary: "#ea580c" });
    await expect(api.updateSettings(data)).resolves.toEqual({ success: true, message: "Salvo" });
    expect(fetcher.mock.calls[1]?.[0]).toBe("/api/admin/settings");
    expect(fetcher.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "PUT", body: JSON.stringify(data) }));
  });
  it("retorna falha explícita em recusa e resposta incompatível", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ arbitrary: true })));
    const api = createSettingsApi(createHttpClient({ fetcher }));
    await expect(api.getSettings()).resolves.toEqual({ success: false, error: "Não autenticado" });
    await expect(api.getSettings()).resolves.toEqual({ success: false, error: "Resposta inválida das configurações." });
  });
  // Onda 134: "Usar minhas categorias" nos destaques do rodapé lê as categorias da locadora no painel.
  it("lista só os nomes das categorias da locadora; resposta fora do formato lança", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "c1", name: "Andaimes" }, { id: "c2", name: 7 }, null, { id: "c3", name: "Betoneiras" }])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ x: 1 })));
    const api = createSettingsApi(createHttpClient({ fetcher }));
    await expect(api.listCategoryNames()).resolves.toEqual(["Andaimes", "Betoneiras"]);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/admin/categories");
    await expect(api.listCategoryNames()).rejects.toThrow("Resposta inválida das categorias.");
  });
});
