import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { themes } from "@gb-locacoes/design-tokens";

const recorded = vi.hoisted(() => ({ calls: [] as Array<{ host: string; props: Record<string, unknown> }> }));

vi.mock("react-native", () => {
  const host = (name: string) =>
    function Host(props: Record<string, unknown> & { children?: ReactNode }) {
      const style =
        typeof props.style === "function"
          ? (props.style as (s: { pressed: boolean }) => unknown)({ pressed: false })
          : props.style;
      recorded.calls.push({ host: name, props: { ...props, style } });
      return createElement(`rn-${name.toLowerCase()}`, null, props.children);
    };
  return {
    Pressable: host("Pressable"),
    Text: host("Text"),
    ActivityIndicator: host("ActivityIndicator"),
    View: host("View"),
  };
});

const { ThemeProvider } = await import("../theme/ThemeProvider");
const { CTAButton } = await import("./CTAButton.native");

const styleOf = (host: string) =>
  recorded.calls.find((c) => c.host === host)?.props.style as Record<string, unknown> | undefined;

describe("CTAButton (native)", () => {
  beforeEach(() => {
    recorded.calls = [];
  });

  it("usa o token primary laranja no variant primary", () => {
    renderToStaticMarkup(
      createElement(ThemeProvider, null, createElement(CTAButton, { children: "Solicitar Orçamento", variant: "primary" })),
    );
    const pressable = styleOf("Pressable");
    const text = styleOf("Text");
    expect(String(pressable?.backgroundColor).toUpperCase()).toBe(themes.light.primary.toUpperCase());
    expect(String(text?.color).toUpperCase()).toBe(themes.light.onPrimary.toUpperCase());
  });

  it("não pressiona quando disabled", () => {
    renderToStaticMarkup(
      createElement(ThemeProvider, null, createElement(CTAButton, { children: "Ação", disabled: true })),
    );
    const props = recorded.calls.find((c) => c.host === "Pressable")?.props;
    expect(props?.accessibilityState).toEqual({ disabled: true });
    expect(props?.disabled).toBe(true);
    expect(props?.onPress).toBeUndefined();
  });
});
