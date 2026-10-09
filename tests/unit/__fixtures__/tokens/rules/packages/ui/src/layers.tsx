// Fixture de tools/token-check.mjs: z-index-literal em classes e em objetos de estilo.
export const detectedClasses = ["z-50", "-z-10", "z-[9999]", "hover:z-20", "[z-index:30]"];

const OVERLAY_LAYER = 40;

export const detectedStyles = [
  { zIndex: 20 },
  { zIndex: "5" },
  { zIndex: -1 },
  { zIndex: OVERLAY_LAYER },
];

export const exempt = {
  classes: "z-[var(--layer-dialog)] z-auto size-4",
  style: { zIndex: "var(--layer-tooltip)" },
};
