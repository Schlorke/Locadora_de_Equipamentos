// Fixture de tools/token-check.mjs: valores arbitrários do Tailwind com cor ou dimensão.
export const detectedDimension = [
  "w-[123px]",
  "h-[calc(100vh-64px)]",
  "md:top-[3.5rem]",
  "max-w-[calc(100%-2rem)]",
  "[--gap:12px]",
];

// `_rgba(` escapava da regra absoluta color-literal; agora é arbitrary-color.
export const detectedColor = "group-hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]";

// Hex dentro do valor arbitrário continua na regra absoluta color-literal.
export const detectedAbsolute = "bg-[#ea580c]";

export const exempt = [
  "w-[var(--sidebar-width)] bg-[hsl(var(--primary))]",
  "duration-[400ms] rotate-[15deg] translate-x-[-50%] leading-[1.2]",
  "grid-cols-[repeat(3,minmax(0,1fr))] w-[0px]",
  "[&_svg]:size-4 data-[state=open]:rotate-180 bg-[url(/hero.png)]",
];
