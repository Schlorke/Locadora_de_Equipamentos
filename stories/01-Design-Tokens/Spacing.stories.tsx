import type { Meta, StoryObj } from '@storybook/nextjs-vite'

const meta = {
  title: 'Design Tokens/Spacing',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Sistema de espaçamento consistente baseado em múltiplos de 4px. Use sempre estes valores para padding, margin e gaps em toda a aplicação.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// Spacing Box Component
const SpacingBox = ({
  size,
  pixels,
  rem,
  className,
}: {
  size: string
  pixels: string
  rem: string
  className: string
}) => (
  <div className="flex items-center gap-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
    <div className="shrink-0">
      <div className="relative">
        <div
          className={`bg-orange-500 rounded ${className}`}
          style={{ width: 'fit-content', height: 'fit-content' }}
        >
          <div className="w-4 h-4" />
        </div>
      </div>
    </div>
    <div className="flex-1">
      <div className="font-semibold text-lg">{size}</div>
      <div className="text-sm text-gray-600">
        {pixels} • {rem}
      </div>
      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
        {className}
      </code>
    </div>
  </div>
)

export const AllSpacing: Story = {
  render: () => (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Sistema de Espaçamento</h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Sistema consistente baseado em múltiplos de 4px para padding,
            margin, gaps e outros espaçamentos. Use sempre estas classes
            Tailwind para manter consistência visual.
          </p>
        </div>

        {/* Spacing Scale */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Escala de Espaçamento</h2>
          <div className="space-y-4">
            <SpacingBox size="XS" pixels="4px" rem="0.25rem" className="p-1" />
            <SpacingBox size="SM" pixels="8px" rem="0.5rem" className="p-2" />
            <SpacingBox size="MD" pixels="16px" rem="1rem" className="p-4" />
            <SpacingBox size="LG" pixels="24px" rem="1.5rem" className="p-6" />
            <SpacingBox size="XL" pixels="32px" rem="2rem" className="p-8" />
            <SpacingBox size="2XL" pixels="48px" rem="3rem" className="p-12" />
          </div>
        </div>

        {/* Visual Comparison */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Comparação Visual</h2>
          <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-end gap-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="bg-orange-500 rounded"
                  style={{ width: '4px', height: '100px' }}
                />
                <span className="text-xs font-mono">4px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="bg-orange-500 rounded"
                  style={{ width: '8px', height: '100px' }}
                />
                <span className="text-xs font-mono">8px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="bg-orange-500 rounded"
                  style={{ width: '16px', height: '100px' }}
                />
                <span className="text-xs font-mono">16px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="bg-orange-500 rounded"
                  style={{ width: '24px', height: '100px' }}
                />
                <span className="text-xs font-mono">24px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="bg-orange-500 rounded"
                  style={{ width: '32px', height: '100px' }}
                />
                <span className="text-xs font-mono">32px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="bg-orange-500 rounded"
                  style={{ width: '48px', height: '100px' }}
                />
                <span className="text-xs font-mono">48px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Responsive Patterns */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            Padrões Responsivos Obrigatórios
          </h2>

          <div className="space-y-6">
            {/* Container Padding */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3">
                Padding Lateral de Containers
              </h3>
              <div className="bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300">
                <div className="bg-orange-500/20 px-4 sm:px-6 lg:px-8 py-6 rounded">
                  <div className="bg-white p-4 rounded">
                    <p className="text-sm text-gray-700">
                      Conteúdo com padding responsivo
                    </p>
                  </div>
                </div>
              </div>
              <code className="text-sm bg-gray-900 text-green-400 p-3 rounded mt-3 block">
                px-4 sm:px-6 lg:px-8
              </code>
              <p className="text-sm text-gray-600 mt-2">
                16px (mobile) → 24px (tablet) → 32px (desktop)
              </p>
            </div>

            {/* Vertical Spacing */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3">
                Espaçamento Vertical Entre Seções
              </h3>
              <div className="space-y-4">
                <div className="bg-orange-500/20 py-12 md:py-16 lg:py-20 rounded flex items-center justify-center">
                  <span className="text-sm font-semibold">Seção 1</span>
                </div>
                <div className="bg-orange-500/20 py-12 md:py-16 lg:py-20 rounded flex items-center justify-center">
                  <span className="text-sm font-semibold">Seção 2</span>
                </div>
              </div>
              <code className="text-sm bg-gray-900 text-green-400 p-3 rounded mt-3 block">
                py-12 md:py-16 lg:py-20
              </code>
              <p className="text-sm text-gray-600 mt-2">
                48px (mobile) → 64px (tablet) → 80px (desktop)
              </p>
            </div>

            {/* Grid Gaps */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3">Gaps em Grids</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 lg:gap-12">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                  <div
                    key={item}
                    className="bg-orange-500/20 h-24 rounded flex items-center justify-center"
                  >
                    <span className="text-sm font-semibold">{item}</span>
                  </div>
                ))}
              </div>
              <code className="text-sm bg-gray-900 text-green-400 p-3 rounded mt-3 block">
                gap-6 md:gap-8 lg:gap-12
              </code>
              <p className="text-sm text-gray-600 mt-2">
                24px (mobile) → 32px (tablet) → 48px (desktop)
              </p>
            </div>

            {/* Margin Between Elements */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3">
                Margens Entre Elementos
              </h3>
              <div className="space-y-4">
                <div className="bg-orange-500/20 p-4 rounded mb-6 md:mb-8">
                  <span className="text-sm">Elemento com mb-6 md:mb-8</span>
                </div>
                <div className="bg-orange-500/20 p-4 rounded mb-8 md:mb-12">
                  <span className="text-sm">Elemento com mb-8 md:mb-12</span>
                </div>
                <div className="bg-orange-500/20 p-4 rounded mb-12 md:mb-16">
                  <span className="text-sm">Elemento com mb-12 md:mb-16</span>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                  mb-4 md:mb-6 {/* 16px → 24px */}
                </code>
                <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                  mb-6 md:mb-8 {/* 24px → 32px */}
                </code>
                <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                  mb-8 md:mb-12 {/* 32px → 48px */}
                </code>
                <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                  mb-12 md:mb-16 {/* 48px → 64px */}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Common Patterns */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            Padrões Comuns de Espaçamento
          </h2>

          <div className="space-y-6">
            {/* Card Padding */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3">Padding de Cards</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded border border-gray-300">
                  <div className="font-semibold text-sm mb-2">Card Pequeno</div>
                  <code className="text-xs bg-gray-900 text-green-400 px-2 py-1 rounded">
                    p-4 (16px)
                  </code>
                </div>
                <div className="p-6 bg-gray-50 rounded border border-gray-300">
                  <div className="font-semibold text-sm mb-2">Card Médio</div>
                  <code className="text-xs bg-gray-900 text-green-400 px-2 py-1 rounded">
                    p-6 (24px)
                  </code>
                </div>
                <div className="p-8 bg-gray-50 rounded border border-gray-300">
                  <div className="font-semibold text-sm mb-2">Card Grande</div>
                  <code className="text-xs bg-gray-900 text-green-400 px-2 py-1 rounded">
                    p-8 (32px)
                  </code>
                </div>
                <div className="p-6 md:p-8 bg-gray-50 rounded border border-gray-300">
                  <div className="font-semibold text-sm mb-2">
                    Card Responsivo
                  </div>
                  <code className="text-xs bg-gray-900 text-green-400 px-2 py-1 rounded">
                    p-6 md:p-8
                  </code>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3">
                Espaçamento em Formulários
              </h3>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Campo 1
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    placeholder="px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Campo 2
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    placeholder="px-3 py-2"
                  />
                </div>
              </form>
              <code className="text-sm bg-gray-900 text-green-400 p-3 rounded mt-4 block">
                space-y-4 {/* Espaçamento vertical entre campos */}
              </code>
            </div>

            {/* Button Spacing */}
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-3">
                Espaçamento de Botões
              </h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-orange-600 text-white rounded text-sm">
                    Pequeno (px-3 py-1.5)
                  </button>
                  <button className="px-4 py-2 bg-orange-600 text-white rounded">
                    Médio (px-4 py-2)
                  </button>
                  <button className="px-8 py-3 bg-orange-600 text-white rounded">
                    Grande (px-8 py-3)
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-orange-600 text-white rounded">
                    Botão 1
                  </button>
                  <button className="px-4 py-2 bg-slate-700 text-white rounded">
                    Botão 2
                  </button>
                  <button className="px-4 py-2 bg-slate-700 text-white rounded">
                    Botão 3
                  </button>
                </div>
                <code className="text-sm bg-gray-900 text-green-400 p-3 rounded block">
                  gap-3 {/* Espaçamento entre botões */}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Guidelines */}
        <div className="p-8 bg-white rounded-xl shadow-md">
          <h2 className="text-2xl font-bold mb-4">📝 Diretrizes de Uso</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">
                ✅ Sempre use classes Tailwind
              </h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                {`<div className="px-4 sm:px-6 lg:px-8 py-12 md:py-16">
  Conteúdo responsivo
</div>`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">
                ❌ Evite valores customizados
              </h3>
              <pre className="bg-gray-900 text-red-400 p-4 rounded-lg overflow-x-auto">
                {`<div style={{ padding: '18px' }}> {/* NÃO FAÇA */}
  Use sempre múltiplos de 4px
</div>`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">
                📱 Mobile-First Sempre
              </h3>
              <p className="text-gray-700 mb-2">
                Comece com valores mobile e adicione breakpoints maiores:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Base (mobile): sem prefixo</li>
                <li>Small (640px+): prefixo sm:</li>
                <li>Medium (768px+): prefixo md:</li>
                <li>Large (1024px+): prefixo lg:</li>
                <li>Extra Large (1280px+): prefixo xl:</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">
                🎯 Consistência é Chave
              </h3>
              <p className="text-gray-700">
                Use sempre os mesmos padrões em contextos similares:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 mt-2">
                <li>Cards: p-6 md:p-8</li>
                <li>Containers: px-4 sm:px-6 lg:px-8</li>
                <li>Seções: py-12 md:py-16 lg:py-20</li>
                <li>Grids: gap-6 md:gap-8 lg:gap-12</li>
                <li>Formulários: space-y-4 ou space-y-6</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">♿ Acessibilidade</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Áreas de toque: mínimo 44x44px (WCAG 2.1 AA)</li>
                <li>Espaçamento entre elementos interativos: mínimo 8px</li>
                <li>Padding interno de botões: mínimo px-4 py-2</li>
                <li>Margens generosas em formulários para legibilidade</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
}

export const SpacingScale: Story = {
  render: () => (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold mb-6">Escala de Espaçamento</h2>
      <SpacingBox size="XS" pixels="4px" rem="0.25rem" className="p-1" />
      <SpacingBox size="SM" pixels="8px" rem="0.5rem" className="p-2" />
      <SpacingBox size="MD" pixels="16px" rem="1rem" className="p-4" />
      <SpacingBox size="LG" pixels="24px" rem="1.5rem" className="p-6" />
      <SpacingBox size="XL" pixels="32px" rem="2rem" className="p-8" />
      <SpacingBox size="2XL" pixels="48px" rem="3rem" className="p-12" />
    </div>
  ),
}

export const ResponsivePatterns: Story = {
  render: () => (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold mb-6">Padrões Responsivos</h2>

      {/* Container Padding */}
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold mb-3">Container Padding</h3>
        <div className="bg-orange-500/20 px-4 sm:px-6 lg:px-8 py-6 rounded">
          <div className="bg-white p-4 rounded">
            <code className="text-sm">px-4 sm:px-6 lg:px-8</code>
          </div>
        </div>
      </div>

      {/* Vertical Spacing */}
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold mb-3">Vertical Spacing</h3>
        <div className="bg-orange-500/20 py-12 md:py-16 lg:py-20 rounded flex items-center justify-center">
          <code className="text-sm">py-12 md:py-16 lg:py-20</code>
        </div>
      </div>

      {/* Grid Gaps */}
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold mb-3">Grid Gaps</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="bg-orange-500/20 h-24 rounded flex items-center justify-center"
            >
              {item}
            </div>
          ))}
        </div>
        <code className="text-sm block mt-3">gap-6 md:gap-8</code>
      </div>
    </div>
  ),
}
