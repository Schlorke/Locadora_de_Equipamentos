import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recorded = vi.hoisted(() => ({ calls: [] as Array<{ host: string; props: Record<string, unknown> }> }));

vi.mock("react-native", () => {
  const host = (name: string) =>
    function Host(props: Record<string, unknown> & { children?: ReactNode }) {
      recorded.calls.push({ host: name, props });
      return createElement(`rn-${name.toLowerCase()}`, null, props.children);
    };
  return { Pressable: host("Pressable"), Text: host("Text"), TextInput: host("TextInput"), View: host("View") };
});

const { ThemeProvider } = await import("../theme/ThemeProvider");
const { Input } = await import("./Input.native");

describe("Input (native)", () => {
  beforeEach(() => {
    recorded.calls = [];
  });

  it("does not forward changes when disabled", () => {
    renderToStaticMarkup(createElement(ThemeProvider, null, createElement(Input, { disabled: true, type: "number" })));
    const field = recorded.calls.find((c) => c.host === "TextInput")?.props;
    expect(field?.editable).toBe(false);
    expect(field?.onChangeText).toBeUndefined();
    const labels = recorded.calls.filter((c) => c.host === "Pressable").map((c) => c.props.accessibilityLabel);
    expect(labels).toEqual(["Incrementar", "Decrementar"]);
  });
});
