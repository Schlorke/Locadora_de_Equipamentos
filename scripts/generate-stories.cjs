#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Componentes que já têm stories
const existingStories = [
  'Button',
  'Input',
  'Badge',
  'Card',
  'AdminFilterCard',
  'EquipmentCard',
  'Header',
  'DesignTokens',
]

// Componentes UI que precisam de stories
const uiComponents = [
  'Avatar',
  'Alert',
  'AlertDialog',
  'AspectRatio',
  'Breadcrumb',
  'Calendar',
  'Carousel',
  'Checkbox',
  'CloseButton',
  'Collapsible',
  'ContextMenu',
  'CurrencyInput',
  'CustomSelect',
  'Drawer',
  'DropdownMenu',
  'FilterIndicator',
  'FilterResetButton',
  'FilterSelectGroup',
  'Form',
  'HoverCard',
  'ImageUpload',
  'InputOtp',
  'Label',
  'NavigationMenu',
  'Pagination',
  'Progress',
  'RadioGroup',
  'Resizable',
  'ScrollArea',
  'Select',
  'Separator',
  'Sheet',
  'Sidebar',
  'Skeleton',
  'Slider',
  'Sonner',
  'Switch',
  'Table',
  'Tabs',
  'Textarea',
  'Toast',
  'Toaster',
  'ToggleGroup',
  'Toggle',
  'Tooltip',
]

// Componentes principais que precisam de stories
const mainComponents = [
  'ContactForm',
  'ContactSection',
  'FeaturedMaterials',
  'Footer',
  'Hero',
  'HomePageClient',
  'ImageCarouselZoom',
  'Mdx',
  'ScrollRevealInit',
  'ThemeProvider',
  'WhatsappFab',
  'WhyChooseUs',
]

// Componentes Admin que precisam de stories
const adminComponents = [
  'AdminCard',
  'AdminHeader',
  'AdminMobileHeader',
  'AdminPageHeader',
  'AdminSidebar',
  'HeroCarouselManager',
  'MiniCarousel',
  'MobileSidebar',
  'SettingsBlock',
  'SettingsNavigationBar',
  'SettingsPreviews',
]

function generateBasicStory(componentName, category) {
  const storyContent = `import type { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from '@/components/${category === 'ui' ? 'ui' : category}/${componentName.toLowerCase()}';

const meta: Meta<typeof ${componentName}> = {
  title: '${category === 'ui' ? 'Atoms' : category === 'admin' ? 'Admin' : 'Organisms'}/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Componente ${componentName.toLowerCase()} - descrição a ser adicionada.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj<typeof ${componentName}> = {
  args: {},
};

export const Variant: StoryObj<typeof ${componentName}> = {
  args: {
    // Props específicas do componente
  },
};
`

  return storyContent
}

function createStoryFile(componentName, category) {
  if (existingStories.includes(componentName)) {
    console.log(`⚠️  Story já existe para ${componentName}`)
    return
  }

  const storyDir = path.join(
    __dirname,
    '..',
    'stories',
    category === 'ui' ? 'atoms' : category === 'admin' ? 'admin' : 'organisms'
  )
  const storyPath = path.join(storyDir, `${componentName}.stories.tsx`)

  // Criar diretório se não existir
  if (!fs.existsSync(storyDir)) {
    fs.mkdirSync(storyDir, { recursive: true })
  }

  const storyContent = generateBasicStory(componentName, category)

  fs.writeFileSync(storyPath, storyContent)
  console.log(`✅ Criada story para ${componentName} em ${storyPath}`)
}

function main() {
  console.log('🚀 Gerando stories para componentes...\n')

  // Gerar stories para componentes UI
  console.log('📦 Componentes UI:')
  uiComponents.forEach((component) => {
    createStoryFile(component, 'ui')
  })

  // Gerar stories para componentes principais
  console.log('\n🏗️  Componentes Principais:')
  mainComponents.forEach((component) => {
    createStoryFile(component, 'main')
  })

  // Gerar stories para componentes Admin
  console.log('\n👨‍💼 Componentes Admin:')
  adminComponents.forEach((component) => {
    createStoryFile(component, 'admin')
  })

  console.log('\n✨ Geração de stories concluída!')
  console.log('\n📝 Próximos passos:')
  console.log('1. Revisar e customizar as stories geradas')
  console.log('2. Adicionar props e variantes específicas')
  console.log('3. Testar no Storybook (pnpm storybook)')
  console.log('4. Executar testes de acessibilidade')
}

if (require.main === module) {
  main()
}

module.exports = { generateBasicStory, createStoryFile }
