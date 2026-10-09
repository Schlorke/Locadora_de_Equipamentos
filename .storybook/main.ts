// This file has been automatically migrated to valid ESM format by Storybook.
import type { StorybookConfig } from '@storybook/nextjs-vite'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    // Configuração do Next do host web (onda 135, A2). Sem `nextConfigPath`, o plugin do framework carrega o
    // next.config.mjs do diretório de trabalho, que era o da raiz legada.
    options: {
      nextConfigPath: resolve(__dirname, '../apps/clients/web/next.config.mjs'),
    },
  },
  staticDirs: ['../public'],

  // Configuração de aliases para Vite (mesmo do projeto)
  viteFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': resolve(__dirname, '../'),
      }
    }
    return config
  },
}
export default config
