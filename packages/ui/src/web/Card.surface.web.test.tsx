import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.web";
import { Card, CardContent, CardTitle } from "./Card.web";

const render = (el: ReactElement) => renderToStaticMarkup(el);

describe("Card e Badge (web)", () => {
  it("keeps the card surface classes", () => {
    const html = render(
      <Card>
        <CardTitle>Betoneira</CardTitle>
        <CardContent>Diária</CardContent>
      </Card>,
    );
    expect(html).toContain("rounded-lg border bg-card");
    expect(html).toContain("Betoneira");
    expect(html).toContain("p-6 pt-0");
  });

  it("keeps the default badge classes", () => {
    expect(render(<Badge>Disponível</Badge>)).toContain("bg-primary text-primary-foreground");
  });
});
