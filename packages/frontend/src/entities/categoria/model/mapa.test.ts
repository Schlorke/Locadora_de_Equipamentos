import { describe, expect, it } from "vitest";
import { CATEGORY_PAGE_SIZE, categoryToDialogCategoryData, dialogCategoryDataToApiPayload } from "./mapa";

const defaults = {
  backgroundColor: "#3b82f6",
  fontColor: "#ffffff",
  iconColor: "#ffffff",
  icon: "Tag",
  customIcon: { source: "none" },
  placement: "types",
};

describe("mapa da categoria", () => {
  it("usa o desenho padrão e a página de 9", () => {
    expect(CATEGORY_PAGE_SIZE).toBe(9);
    const mapped = categoryToDialogCategoryData({ id: "1", name: "Altura" }, defaults);
    expect(mapped.description).toBe("");
    expect(mapped.design.backgroundColor).toBe("#3b82f6");
    expect(mapped.design.icon).toBe("Tag");
    expect(mapped.design.placement).toBe("types");
  });

  it("lê o ícone customizado em texto e ignora JSON inválido", () => {
    const parsed = categoryToDialogCategoryData(
      { id: "1", name: "Altura", customIcon: '{"source":"emoji"}', bgColor: "#111111" },
      defaults,
    );
    expect(parsed.design.customIcon).toEqual({ source: "emoji" });
    expect(parsed.design.backgroundColor).toBe("#111111");

    const broken = categoryToDialogCategoryData(
      { id: "1", name: "Altura", customIcon: "{nao-json" },
      defaults,
    );
    expect(broken.design.customIcon).toEqual({ source: "none" });
  });

  it("omite o ícone lucide quando a origem não é none", () => {
    const none = dialogCategoryDataToApiPayload({
      name: "Altura",
      description: "Trabalho em altura",
      design: {
        backgroundColor: "#3b82f6",
        fontColor: "#ffffff",
        iconColor: "#ffffff",
        icon: "Tag",
        placement: "types",
        customIcon: { source: "none" },
      },
    });
    expect(none.icon).toBe("Tag");
    expect(none.customIcon).toBeNull();
    expect(none.bgColor).toBe("#3b82f6");

    const emoji = dialogCategoryDataToApiPayload({
      name: "Altura",
      description: "",
      design: {
        backgroundColor: "#3b82f6",
        fontColor: "#ffffff",
        iconColor: "#ffffff",
        icon: "Tag",
        placement: "",
        customIcon: { source: "emoji" },
      },
    });
    expect(emoji.icon).toBeNull();
    expect(emoji.customIcon).toEqual({ source: "emoji" });
    expect(emoji.placement).toBeNull();
  });
});
