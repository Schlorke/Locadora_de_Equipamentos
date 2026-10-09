export function parseCurrencyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function digitsToCurrencyNumber(digits: string): number {
  if (!digits) return 0;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric / 100 : 0;
}

export function formatCurrencyInput(num: number, locale = "pt-BR", currency = "BRL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
