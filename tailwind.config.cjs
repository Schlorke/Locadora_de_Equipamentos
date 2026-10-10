// tailwind.config.cjs
// Converted from ESM to CJS for compatibility with PostCSS in Next.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  // O produto e o host web são cobertos pelos @source explícitos do CSS.
  // A raiz aposentada não fornece classes; testes continuam fora das fontes.
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      fontSize: {
        h1: ['clamp(2.5rem, 5vw, 3.5rem)', { lineHeight: '1.2' }],
        h2: ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.3' }],
        h3: ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.4' }],
        base: ['clamp(1rem, 2vw, 1.125rem)', { lineHeight: '1.6' }],
        small: ['clamp(0.875rem, 1.5vw, 1rem)', { lineHeight: '1.5' }],
      },
      letterSpacing: {
        tight: '-0.015em',
        wide: '0.015em',
      },
      // A paleta (orange-600…) é a da produção, em hex, no @theme de packages/design-tokens/src/palette.css. Os tokens
      // do Style Dictionary (design-tokens/output/tokens-tailwind.json) não entram como cores: `base` e `small` viravam
      // cores e roubavam text-base/text-small do tamanho de fonte acima.
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('tailwind-scrollbar')],
}
