"use client";
import { resolveTextStyle, type TextProps } from "../contract/text";
import { useTheme } from "../theme/ThemeProvider";

export function Text({ children, size = "md", tone = "default", heading }: TextProps) {
  const { lineHeight, ...s } = resolveTextStyle(useTheme(), size, tone, heading);
  const Tag = heading ? (`h${heading}` as "h1" | "h2" | "h3") : "p";
  // A escala de altura de linha é em px (no nativo o número já é px); no style do React web um número seria um
  // multiplicador da fonte (`line-height: 24` = 24 vezes o tamanho), então a unidade vai explícita.
  return <Tag style={{ margin: 0, ...s, lineHeight: `${lineHeight}px` }}>{children}</Tag>;
}
