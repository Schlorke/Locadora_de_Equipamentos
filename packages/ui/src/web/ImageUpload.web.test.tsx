import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ImageUpload", () => {
  it("limita a 5 imagens e avisa em português", () => {
    const source = readFileSync(new URL("./ImageUpload.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("maxImages = 5");
    expect(source).toContain("Limite excedido");
    expect(source).toContain("Máximo de ${maxImages} imagens permitidas");
    expect(source).toContain("Upload concluído");
    expect(source).toContain("URL inválida");
    expect(source).toContain('accept="image/*"');
    expect(source).toContain('placeholder="https://exemplo.com/imagem.jpg"');
    expect(source).toContain("Arrastar imagem");
    expect(source).toContain('aria-label="Navegar para imagem anterior"');
    expect(source).toContain("Imagens ({images.length}/{maxImages})");
    const native = readFileSync(new URL("../native/ImageUpload.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("next/image");
    expect(native).toContain("Imagens");
  });
});
