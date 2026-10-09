import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Accordion, AccordionItem, AccordionTrigger } from "./Accordion.web";
import { AlertDialog, AlertDialogTrigger } from "./AlertDialog.web";
import { Button } from "./Button.web";
import { Collapsible, CollapsibleTrigger } from "./Collapsible.web";
import { Dialog } from "./Dialog.web";
import { DropdownMenu, DropdownMenuTrigger } from "./DropdownMenu.web";
import { MENU_FOCUS_RING } from "./focus-ring";
import { Menubar, MenubarMenu, MenubarTrigger } from "./Menubar.web";
import { NavigationMenu, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger } from "./NavigationMenu.web";
import { Popover, PopoverTrigger } from "./Popover.web";
import { Sheet, SheetTrigger } from "./Sheet.web";
import { MENU_TRIGGER_FRAME, TRIGGER_FRAME } from "./trigger";

const split = (value: string) => value.split(/\s+/).filter(Boolean);
/** Classes do primeiro <button> renderizado. */
const buttonClasses = (element: ReactElement) => split(/<button[^>]*class="([^"]*)"/.exec(renderToStaticMarkup(element))?.[1] ?? "");

describe("molduras de gatilho", () => {
  it("o gatilho só ganha a moldura dos campos enquanto controla o conteúdo aberto (variante controls:)", () => {
    const classes = split(TRIGGER_FRAME);
    expect(classes.every((cls) => cls.startsWith("controls:"))).toBe(true);
    for (const cls of [
      "controls:border-field",
      "controls:shadow-control",
      "controls:hover-always:not-focus:shadow-control-hover",
      "controls:focus:border-field-focus",
      "controls:focus:shadow-control-focus",
      "controls:focus:outline-2",
      "controls:focus:outline-field-focus",
    ])
      expect(classes, cls).toContain(cls);
  });

  it("gatilho de menu: sem sombra nem halo no foco e com o anel só pelo teclado", () => {
    const classes = split(MENU_TRIGGER_FRAME);
    for (const cls of [...split(MENU_FOCUS_RING), "focus:[box-shadow:none]", "controls:focus:[box-shadow:none]", "controls:shadow-control"])
      expect(classes, cls).toContain(cls);
    expect(classes).not.toContain("controls:focus:shadow-control-focus");
    expect(classes).not.toContain("controls:focus:outline-2");
  });

  it("os gatilhos de packages/ui aplicam a moldura", () => {
    const withFrame: Array<[string, ReactElement]> = [
      ["Popover", h(Popover, null, h(PopoverTrigger, null, "Abrir"))],
      ["Collapsible", h(Collapsible, null, h(CollapsibleTrigger, null, "Abrir"))],
      ["AlertDialog", h(AlertDialog, null, h(AlertDialogTrigger, null, "Abrir"))],
      ["Sheet", h(Sheet, null, h(SheetTrigger, null, "Abrir"))],
      ["Dialog", h(Dialog.Root, null, h(Dialog.Trigger, null, "Abrir"))],
      ["Accordion", h(Accordion, { type: "single" }, h(AccordionItem, { value: "a" }, h(AccordionTrigger, null, "Abrir")))],
      [
        "NavigationMenu",
        h(NavigationMenu, null, h(NavigationMenuList, null, h(NavigationMenuItem, null, h(NavigationMenuTrigger, null, "Abrir")))),
      ],
    ];
    for (const [name, element] of withFrame) {
      const classes = buttonClasses(element);
      for (const cls of split(TRIGGER_FRAME)) expect(classes, `${name}: ${cls}`).toContain(cls);
    }
    const menus: Array<[string, ReactElement]> = [
      ["DropdownMenu", h(DropdownMenu, null, h(DropdownMenuTrigger, null, "Abrir"))],
      ["Menubar", h(Menubar, null, h(MenubarMenu, null, h(MenubarTrigger, null, "Abrir")))],
    ];
    for (const [name, element] of menus) {
      const classes = buttonClasses(element);
      for (const cls of split(MENU_TRIGGER_FRAME)) expect(classes, `${name}: ${cls}`).toContain(cls);
    }
  });

  it("com asChild, a moldura passa ao filho junto com as classes dele", () => {
    const classes = buttonClasses(h(Popover, null, h(PopoverTrigger, { asChild: true }, h(Button, { variant: "outline" }, "Abrir"))));
    expect(classes).toContain("shadow-md");
    for (const cls of split(TRIGGER_FRAME)) expect(classes, cls).toContain(cls);
  });
});
