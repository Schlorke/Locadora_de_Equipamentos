import { describe, expect, it } from 'vitest'
import {
  documentTokens,
  financialCalendarColors,
  financialReportTokens,
} from './documents'

describe('existing printable document contract', () => {
  it('preserves the original RGB colors independently of screen themes', () => {
    const normalized = Object.fromEntries(
      Object.entries(documentTokens.colors).map(([name, color]) => [
        name,
        color.length === 4
          ? '#' +
            [...color.slice(1)].map((channel) => channel.repeat(2)).join('')
          : color.toLowerCase(),
      ])
    )
    expect(normalized).toEqual({
      brand: '#f97316',
      onBrand: '#ffffff',
      strong: '#1f2937',
      onStrong: '#ffffff',
      text: '#111827',
      textSecondary: '#6b7280',
      textMuted: '#9ca3af',
      border: '#d1d5db',
      borderLight: '#e5e7eb',
      surface: '#f9fafb',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#d97706',
    })
  })
  it('preserves A4 geometry and font sizes in points without converting to pixels', () => {
    expect(documentTokens.layout).toEqual({
      pageWidth: 595.28,
      pageHeight: 841.89,
      marginTop: 42,
      marginBottom: 42,
      marginLeft: 42,
      marginRight: 42,
      titleSize: 16,
      subtitleSize: 12,
      sectionHeaderSize: 11,
      tableHeaderSize: 8.5,
      tableBodySize: 8.5,
      labelSize: 7.5,
      valueSize: 8.5,
      footerSize: 7,
      totalRowSize: 10,
      sectionGap: 16,
      lineHeight: 1.3,
    })
  })
})

it('preserves financial calendar colors independently of themes', () => {
  expect(financialCalendarColors).toEqual({
    paid: '#16a34a',
    unpaid: '#dc2626',
    settled: '#475569',
    awaiting: '#f59e0b',
  })
})
it('preserves the financial report print palette and font sizes', () => {
  expect(financialReportTokens.pdf).toEqual({
    colors: {
      secondary: '#666666',
      accent: '#1a56db',
      text: '#000000',
      border: '#dddddd',
      onStrong: '#ffffff',
      alternate: '#f8f9fa',
      strong: '#333333',
      muted: '#888888',
      footer: '#999999',
    },
    fonts: {
      title: 16,
      subtitle: 9,
      header: 7,
      row: 6.5,
      summary: 10,
      note: 8,
    },
    margins: { top: 40, bottom: 40, left: 35, right: 35 },
  })
  expect(financialReportTokens.xlsx.fonts).toEqual({
    title: 18,
    subtitle: 11,
    section: 14,
    total: 12,
    footer: 9,
    label: 10,
    value: 20,
  })
  expect(financialReportTokens.xlsx.colors).toMatchObject({
    orange: 'FFF97316',
    orangeDark: 'FFEA580C',
    orangeLight: 'FFFFF7ED',
    orangePale: 'FFFEF3C7',
    dark: 'FF1E293B',
    darkMed: 'FF334155',
    gray100: 'FFF1F5F9',
    gray200: 'FFE2E8F0',
    gray300: 'FFCBD5E1',
    gray500: 'FF64748B',
    gray700: 'FF334155',
    gray900: 'FF0F172A',
    white: 'FFFFFFFF',
    green: 'FF16A34A',
    greenBg: 'FFDCFCE7',
    red: 'FFDC2626',
    redBg: 'FFFEE2E2',
    yellowBg: 'FFFEF3C7',
    blueBg: 'FFDBEAFE',
    grayBg: 'FFF1F5F9',
    accent: 'FF1A56DB',
  })
})
