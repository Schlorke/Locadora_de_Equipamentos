// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'

// ESLint v9 flat config for Next.js project
import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import runtimeRewrite, {
  PLUGIN_NAME as RUNTIME_PLUGIN,
  RULE_ID as RUNTIME_REWRITE,
  SERVER_FILES,
  SERVER_IGNORES,
} from './tools/eslint-runtime-rewrite.mjs'

export default [
  // Global ignores
  // JavaScript recommended config
  {
    ignores: [
  "**/node_modules/**",
  "**/.next/**",
  "**/.expo/**",
  "**/dist-export/**",
  "**/coverage/**",
  "**/storybook-static/**",
  "**/out/**",
  "**/dist/**",
  "**/build/**",
  "**/.turbo/**",
  ".tmp/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  "tests/**/__fixtures__/**",
  "**/next-env.d.ts",
  "*.openapi.json",
  "public/openapi.json"
],
  }, // TypeScript files
  js.configs.recommended, // JavaScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        // Next.js specific globals
        React: 'readonly',
        JSX: 'readonly',
        // Additional TypeScript globals
        EventListener: 'readonly',
        NodeJS: 'readonly',
        RequestInit: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript rules
      // Import, variável e função privada sem uso são sobra: erro (o pnpm lint roda com --quiet e esconderia um
      // aviso). A regra base não entende tipos (acusa parâmetro de assinatura de tipo): desligada em TS.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General rules
      'no-console': 'off', // Permitir console.log para desenvolvimento
      'no-debugger': 'error',
      'no-unused-vars': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        // Next.js specific globals
        React: 'readonly',
        JSX: 'readonly',
        // Additional TypeScript globals
        EventListener: 'readonly',
        NodeJS: 'readonly',
        RequestInit: 'readonly',
      },
    },
    rules: {
      'no-console': 'off', // Permitir console.log para desenvolvimento
      'no-debugger': 'error',
      // Sem uso é sobra: erro (ver o bloco de TypeScript).
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  ...storybook.configs['flat/recommended'],

  // Frontend: o caminho vem de useVisiblePathname (sem o prefixo interno /{slug} do host de locadora).
  // usePathname direto diverge entre servidor e navegador quando há rewrite e vaza o caminho interno em callbackUrl.
  {
    files: ['packages/frontend/src/**/*.{ts,tsx}'],
    ignores: ['packages/frontend/src/shared/lib/navigation/use-visible-pathname.web.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/navigation',
              importNames: ['usePathname'],
              message:
                'Use useVisiblePathname de shared/lib/navigation/use-visible-pathname.web (remove o prefixo interno /{slug}).',
            },
          ],
        },
      ],
    },
  },

  // O código de servidor não reescreve o runtime (achado 123): sem reflexão, escrita em global, import ou
  // protótipo, símbolos que mudam a linguagem ou código dinâmico. Regra, exceções (lista fechada, com motivo) e
  // globs em tools/eslint-runtime-rewrite.mjs; o inventário de rotas confere que este bloco cobre o servidor.
  {
    files: [...SERVER_FILES],
    ignores: [...SERVER_IGNORES],
    plugins: { [RUNTIME_PLUGIN]: runtimeRewrite },
    rules: { [RUNTIME_REWRITE]: 'error' },
  },
]
