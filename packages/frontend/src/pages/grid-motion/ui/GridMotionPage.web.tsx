'use client'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { gridItems } from '../model/items'

import {
  AndaimeSuspenso,
  AndaimeTubular,
  Betoneira,
  CadeiraEletrica,
  Compressor,
  GridMotion,
  Lavagem,
  Rompedor,
  Terraplenagem,
  TrabalhoEmAltura,
  Transporte,
} from '@gb-locacoes/ui'

export function GridMotionPage() {
  // Items customizados com ícones SVG do projeto
  const icons = {
    AndaimeSuspenso,
    AndaimeTubular,
    Betoneira,
    CadeiraEletrica,
    Compressor,
    Lavagem,
    Rompedor,
    Terraplenagem,
    TrabalhoEmAltura,
    Transporte,
  }
  const items = gridItems.map((item, index) => {
    if (typeof item === 'string') return item
    const Icon = icons[item.icon]
    return (
      <div key={'icon-' + index} className="flex flex-col items-center gap-2">
        <Icon size={48} color={item.color} />
        <span className="text-xs">{item.label}</span>
      </div>
    )
  })

  return (
    <div className="h-screen w-full">
      <GridMotion
        items={items}
        gradientColor={
          '#1e293b' /* token-check-allow: slate-800 do fundo do playground grid-motion */
        }
      />

      {/* Overlay com informações */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
        <div className="rounded-2xl bg-white/10 p-8 text-center backdrop-blur-md">
          <h1 className="mb-2 text-4xl font-bold text-white drop-shadow-lg md:text-5xl lg:text-6xl">
            {PLATFORM.displayName}
          </h1>
          <p className="text-lg text-white/90 drop-shadow-lg md:text-xl">
            Mova o mouse para ver a mágica acontecer
          </p>
        </div>
      </div>
    </div>
  )
}
