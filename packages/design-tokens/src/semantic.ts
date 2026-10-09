// Nível 2 do design system: papéis semânticos com os VALORES DO WEB APROVADO.
// Cada papel aponta para um primitivo (nenhum valor cru aqui). Os nomes não colidem com a
// fachada antiga (`themes.*.primary` = #ea580c continua existindo lá, intocado):
//   - variáveis shadcn do theme.css (:root/.dark) -> surface/text/action/border/focus/
//     feedback/chart/sidebar (ex.: --primary #0f172a vira surface.inverse);
//   - cores de marca e de estado de design-tokens/base.json -> brand/action.secondary/feedback;
//   - tokens nomeados do tokens.css (hover de marca, bordas, halo de foco) -> brand.hover/border.*/focus.*.
// Papéis que o web não troca no .dark (marca, base.json) mantêm no escuro o valor claro.
// A correspondência papel <-> variável CSS é verificada em semantic.test.ts.
import { primitives } from "./primitives";

const { color: c, alpha: a } = primitives;

export type SemanticMode = "light" | "dark";

export interface SemanticTheme {
  brand: {
    /** Laranja da marca (base.json color.primary, tokens.css --brand). */
    default: string;
    /** Hover de controles marcados (checkbox :checked:hover). */
    hover: string;
    /** base.json color.primary-dark (#f97316, mais vivo que o default). */
    vivid: string;
    /** base.json color.primary-light. */
    subtle: string;
    /** Texto/ícone sobre a cor de marca. */
    onBrand: string;
  };
  surface: {
    /** --background */
    default: string;
    /** --card */
    raised: string;
    /** --popover */
    overlay: string;
    /** --muted */
    muted: string;
    /** --accent (fundo de hover de itens de menu). */
    accent: string;
    /** base.json background.primary. */
    subtle: string;
    /** base.json background.card (cartão translúcido). */
    translucent: string;
    /** --primary: superfície escura invertida (badge padrão, texto de link). */
    inverse: string;
  };
  text: {
    /** --foreground, --card-foreground, --popover-foreground */
    default: string;
    /** --muted-foreground */
    muted: string;
    /** --primary-foreground */
    onInverse: string;
    /** --accent-foreground */
    onAccent: string;
    /** Texto de campo (text-slate-900 dark:text-slate-50 do Input web). */
    strong: string;
  };
  action: {
    /** base.json color.secondary; fundo do botão padrão (slate-700). */
    secondary: string;
    onSecondary: string;
    /** --secondary */
    subtle: string;
    /** --secondary-foreground */
    onSubtle: string;
  };
  border: {
    /** --border */
    default: string;
    /** --input */
    input: string;
    /** Borda cinza clara (gray-200) do tokens.css (--border-subtle) e do botão outline. */
    subtle: string;
    /** Borda cinza média (gray-300) do tokens.css (--border-strong) e do botão reset. */
    strong: string;
  };
  focus: {
    /** --ring */
    ring: string;
    /** --focus-ring: anel de foco por teclado, o laranja da marca nos dois temas. */
    keyboard: string;
    /** Halo de 3px dos campos em foco (tokens.css --focus-halo). */
    halo: string;
    /** Borda de textarea em foco (tokens.css --focus-border). */
    border: string;
  };
  feedback: {
    /** --destructive (base.json color.error no claro). */
    danger: string;
    /** --destructive-foreground */
    onDanger: string;
    success: string;
    warning: string;
    info: string;
  };
  /** --chart-1..5 */
  chart: { "1": string; "2": string; "3": string; "4": string; "5": string };
  /** --sidebar-* */
  sidebar: {
    background: string;
    foreground: string;
    primary: string;
    onPrimary: string;
    accent: string;
    onAccent: string;
    border: string;
    ring: string;
  };
}

const brand: SemanticTheme["brand"] = {
  default: c.orange600,
  hover: c.orange700,
  vivid: c.orange500,
  subtle: c.orange200,
  onBrand: c.white,
};

const feedbackFromBaseJson = { success: c.emerald500, warning: c.amber500, info: c.blue500 } as const;

const light: SemanticTheme = {
  brand: { ...brand },
  surface: {
    default: c.white,
    raised: c.white,
    overlay: c.white,
    muted: c.slate100,
    accent: c.slate100,
    subtle: c.slate50,
    translucent: a.whiteA95,
    inverse: c.slate900,
  },
  text: {
    default: c.slate950Shadcn,
    muted: c.slate500,
    onInverse: c.slate50,
    onAccent: c.slate900,
    strong: c.slate900,
  },
  action: {
    secondary: c.slate700,
    onSecondary: c.white,
    subtle: c.slate100,
    onSubtle: c.slate900,
  },
  border: {
    default: c.slate200,
    input: c.slate200,
    subtle: c.gray200,
    strong: c.gray300,
  },
  focus: {
    ring: c.neutral950,
    keyboard: c.orange600,
    halo: a.blue500A10,
    border: c.blue500,
  },
  feedback: {
    danger: c.red500,
    onDanger: c.slate50,
    ...feedbackFromBaseJson,
  },
  chart: {
    "1": c.chartLight1,
    "2": c.chartLight2,
    "3": c.chartLight3,
    "4": c.chartLight4,
    "5": c.chartLight5,
  },
  sidebar: {
    background: c.zinc50,
    foreground: c.zinc700,
    primary: c.zinc900,
    onPrimary: c.zinc50,
    accent: c.zinc100,
    onAccent: c.zinc900,
    border: c.gray200,
    ring: c.blue500,
  },
};

const dark: SemanticTheme = {
  brand: { ...brand },
  surface: {
    default: c.slate950Shadcn,
    raised: c.slate950Shadcn,
    overlay: c.slate950Shadcn,
    muted: c.slate800,
    accent: c.slate800,
    subtle: c.slate50,
    translucent: a.whiteA95,
    inverse: c.slate50,
  },
  text: {
    default: c.slate50,
    muted: c.slate400,
    onInverse: c.slate900,
    onAccent: c.slate50,
    strong: c.slate50,
  },
  action: {
    secondary: c.slate700,
    onSecondary: c.white,
    subtle: c.slate800,
    onSubtle: c.slate50,
  },
  border: {
    default: c.slate800,
    input: c.slate800,
    subtle: c.gray200,
    strong: c.gray300,
  },
  focus: {
    ring: c.slate300,
    keyboard: c.orange600,
    halo: a.blue500A10,
    border: c.blue500,
  },
  feedback: {
    danger: c.red900,
    onDanger: c.slate50,
    ...feedbackFromBaseJson,
  },
  chart: {
    "1": c.chartDark1,
    "2": c.chartDark2,
    "3": c.chartDark3,
    "4": c.chartDark4,
    "5": c.chartDark5,
  },
  sidebar: {
    background: c.zinc900,
    foreground: c.zinc100,
    primary: c.blue700,
    onPrimary: c.white,
    accent: c.zinc800,
    onAccent: c.zinc100,
    border: c.zinc800,
    ring: c.blue500,
  },
};

export const semanticThemes: Readonly<Record<SemanticMode, SemanticTheme>> = { light, dark };
