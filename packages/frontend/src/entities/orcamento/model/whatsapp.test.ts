// Mensagem de orçamento no WhatsApp com a origem e o nome da própria locadora (achado 143). O teste anterior afirmava
// o defeito: link no domínio da GB e "GB LOCAÇÕES" no cabeçalho e no rodapé da mensagem de qualquer locadora.
import { describe, expect, it } from "vitest";
import { convertFormDataToWhatsApp, formatPhoneForWhatsApp, formatWhatsAppMessage, generateWhatsAppURL } from "./whatsapp";

const EQUIPAMENTO = {
  id: "eq-1",
  name: "Betoneira",
  quantity: 2,
  days: 3,
  pricePerDay: 100,
  finalPrice: 0,
  discount: { type: "percentage" as const, value: 10, period: "semanal" },
};
const CLIENTE = { name: "Ana", phone: "5198205163", email: "ana@cliente.example.test", cpf: "", cnpj: "1", message: "urgente" };

describe("mensagem de orçamento no WhatsApp", () => {
  it("prefixa 55, tira o zero inicial e mantém quem já tem 55", () => {
    expect(formatPhoneForWhatsApp("(41) 98205-163")).toBe("554198205163");
    expect(formatPhoneForWhatsApp("04198205163")).toBe("554198205163");
    expect(formatPhoneForWhatsApp("5541998205163")).toBe("5541998205163");
  });

  it("omite CPF vazio, usa o preço final e coloca o link da locadora na primeira linha", () => {
    const sentAt = new Date("2026-01-05T15:00:00.000Z");
    const data = convertFormDataToWhatsApp(CLIENTE, [EQUIPAMENTO], "https://locadora-a.example.test", "Locadora Ação");
    expect(data.customerCPF).toBeUndefined();
    expect(data.customerCNPJ).toBe("1");
    expect(data.totalAmount).toBe(600);
    expect(data.equipments[0]?.totalPrice).toBe(600);
    expect(data.equipments[0]?.link).toBe("https://locadora-a.example.test/equipamentos/eq-1");

    const message = formatWhatsAppMessage(data, sentAt);
    expect(message.startsWith("https://locadora-a.example.test/equipamentos/eq-1\n\n")).toBe(true);
    expect(message).toContain("🏗️ *SOLICITAÇÃO DE ORÇAMENTO - LOCADORA AÇÃO*");
    expect(message).toContain("• Desconto semanal: -10%");
    expect(message).toContain("• Total: R$ 600.00");
    expect(message).toContain(`⏰ *SOLICITAÇÃO ENVIADA EM:* ${sentAt.toLocaleString("pt-BR")}`);
    expect(message).toContain("📱 *Via Site Locadora Ação*");
    expect(message).not.toContain("CPF:");
    expect(message).not.toMatch(/GB LOCA|GB Loca|locacoesgb/);
  });

  it("sem o nome da locadora: cabeçalho e rodapé neutros, nunca a marca de outra", () => {
    const message = formatWhatsAppMessage(convertFormDataToWhatsApp(CLIENTE, [EQUIPAMENTO], "https://locadora-b.example.test"));
    expect(message).toContain("🏗️ *SOLICITAÇÃO DE ORÇAMENTO*\n\n");
    expect(message.endsWith("\n📱 *Via Site*")).toBe(true);
    expect(message).not.toMatch(/GB LOCA|GB Loca|locacoesgb/);
  });

  it("monta o link wa.me com o telefone da locadora", () => {
    const url = generateWhatsAppURL("5541999990000", "oi");
    expect(url).toBe("https://wa.me/5541999990000?text=oi");
  });
});
