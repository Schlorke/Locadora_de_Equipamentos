// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "./NavigationMenu.web";

beforeAll(() => {
  class Observer { observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal("ResizeObserver", Observer);
});
afterEach(cleanup);

describe("NavigationMenu", () => {
  it("mantém Radix, bg-background, hover:text-orange-600 e bg-popover no web", () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Equipamentos</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/equipamentos/andaimes">Andaimes</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="/orcamento" className={navigationMenuTriggerStyle()}>Orçamento</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );

    expect(screen.getByRole("navigation")).toBeTruthy();
    const trigger = screen.getByRole("button", { name: "Equipamentos" });
    expect(trigger.className).toContain("bg-background");
    expect(trigger.className).toContain("hover:text-orange-600");
    expect(screen.getByRole("link", { name: "Orçamento" }).className).toContain("hover:text-orange-600");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Andaimes" })).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const link = screen.getByRole("link", { name: "Andaimes" });
    expect(link.getAttribute("href")).toBe("/equipamentos/andaimes");
    expect(link.closest(".bg-popover.text-popover-foreground")).not.toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
