import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "./Alert.web";

describe("Alert", () => {
  it("mantém o papel de alerta e o texto destrutivo", () => {
    const html = renderToStaticMarkup(
      createElement(
        Alert,
        { variant: "destructive" },
        createElement(AlertTitle, null, "Boleto Vencido"),
        createElement(
          AlertDescription,
          null,
          "Este boleto está vencido. Entre em contato para gerar um novo boleto ou regularizar o pagamento.",
        ),
      ),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("text-destructive");
    expect(html).toContain("Boleto Vencido");
    expect(html).toContain("mb-1");
    expect(html).toContain("font-medium");
    expect(html).toContain("Este boleto está vencido. Entre em contato para gerar um novo boleto ou regularizar o pagamento.");
    expect(html).toContain("text-sm");
  });
});
