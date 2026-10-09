// Fixture de tools/token-check.mjs: tailwind-palette-class.
// Cada string de `detected` tem exatamente uma classe de paleta; `exempt` não tem nenhuma.
export const detected = [
  "bg-orange-600",
  "hover:text-slate-700",
  "border-gray-200/50",
  "md:dark:from-orange-500",
  "!text-white",
  "[&_svg]:fill-red-500",
  "ring-offset-blue-950",
  // Formas do Tailwind 4.3.3: opacidade decimal e por variável, utilitários de cor novos, tons novos, ! no fim.
  "bg-orange-600/7.5",
  "bg-orange-600/(--alpha)",
  "drop-shadow-orange-600",
  "hover:inset-ring-red-500",
  "inset-shadow-black/10",
  "text-shadow-sky-300",
  "mask-t-from-black",
  "scrollbar-thumb-slate-500",
  "border-bs-zinc-200",
  "dark:accent-mauve-500",
  "caret-mist-600",
  "outline-olive-300/[0.4]",
  "placeholder-taupe-400",
  "stroke-cyan-700!",
];

export const exempt = [
  "bg-primary text-primary-foreground",
  "text-muted-foreground border-border bg-card",
  "bg-transparent text-current border-inherit",
  "bg-gradient-to-r text-sm border-2 ring-2 shadow-md",
  "text-orange text-slate bg-orange-650",
  "drop-shadow-lg inset-shadow-xs text-shadow-md inset-ring-2 mask-t-from-50% bg-primary/50 fill-current outline-hidden",
];

export function Card() {
  return <div className="p-4 bg-card text-slate-900">Card</div>;
}

export const approved = "bg-slate-50"; // token-check-allow: fundo neutro aprovado neste fixture
