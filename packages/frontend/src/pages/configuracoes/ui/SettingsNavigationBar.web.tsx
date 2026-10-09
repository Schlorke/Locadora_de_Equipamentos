'use client'

import { Card, CardContent } from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'
import {
  Building,
  Clock,
  FileText,
  Globe,
  Images,
  Scale,
  Search,
  Settings,
  Share2,
  ShieldCheck,
} from 'lucide-react'
import React, { useState } from 'react'

interface SettingsNavigationBarProps {
  onSectionSelect: (_section: string) => void
  activeSection?: string
  className?: string
}

interface SettingsSection {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const settingsSections: SettingsSection[] = [
  {
    id: 'company',
    label: 'Informações da Empresa',
    icon: Building,
    description: 'Nome, logo, contato e dados gerais',
  },
  {
    id: 'hero',
    label: 'Carrossel Principal',
    icon: Images,
    description: 'Imagens e textos da página inicial',
  },
  {
    id: 'social',
    label: 'Redes Sociais',
    icon: Share2,
    description: 'Links para Instagram, Facebook, etc.',
  },
  {
    id: 'seo',
    label: 'SEO & Meta Tags',
    icon: Search,
    description: 'Otimização para mecanismos de busca',
  },
  {
    id: 'system',
    label: 'Configurações do Sistema',
    icon: Settings,
    description: 'Configurações técnicas e avançadas',
  },
  {
    id: 'custom',
    label: 'Configurações Personalizadas',
    icon: Globe,
    description: 'Configurações específicas do projeto',
  },
  // Onda 134: conteúdo institucional, compromissos e textos legais da locadora, e o formulário do horário.
  {
    id: 'hours',
    label: 'Horário de Funcionamento',
    icon: Clock,
    description: 'Dias e horários de atendimento',
  },
  {
    id: 'content',
    label: 'Conteúdo do Site',
    icon: FileText,
    description: 'Números, história, linha do tempo, mapa e avaliações',
  },
  {
    id: 'commitments',
    label: 'O que você garante',
    icon: ShieldCheck,
    description: 'Compromissos comerciais publicados no site',
  },
  {
    id: 'legal',
    label: 'Textos Legais',
    icon: Scale,
    description: 'Termos, Privacidade e Devolução',
  },
]

export function SettingsNavigationBar({
  onSectionSelect,
  activeSection,
  className,
}: SettingsNavigationBarProps) {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

  return (
    <Card
      className={cn(
        'relative overflow-visible border-0 shadow-xl bg-white backdrop-blur-sm transition-all duration-300',
        className
      )}
    >
      <CardContent className="relative z-10 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          {/* Título da barra */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Configurações do Sistema
              </h2>
              <p className="text-sm text-gray-600">
                Clique em uma configuração para editá-la
              </p>
            </div>
          </div>

          {/* Grid de botões de configuração */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {settingsSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              const isHovered = hoveredSection === section.id

              return (
                <button
                  key={section.id}
                  onClick={() => onSectionSelect(section.id)}
                  onMouseEnter={() => setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                  className={cn(
                    // Base styles similar to reset button
                    'flex flex-col items-center justify-center gap-2 p-6 md:p-4 rounded-lg border transition-all duration-300',
                    'bg-transparent hover:bg-background',
                    // Shadow: md normal, lg on hover and active
                    'border-gray-200',
                    isActive ? 'shadow-lg' : 'shadow-md hover:shadow-lg'
                  )}
                  title={section.description}
                  aria-label={`Configurar ${section.label}`}
                >
                  {/* Ícone com hover laranja */}
                  <Icon
                    className={cn(
                      'w-[22px] h-[22px] md:w-5 md:h-5 transition-all duration-300',
                      isActive
                        ? 'text-orange-500'
                        : isHovered
                          ? 'text-orange-500'
                          : 'text-gray-600'
                    )}
                  />

                  {/* Texto com hover laranja */}
                  <span
                    className={cn(
                      'text-sm md:text-xs font-medium text-center leading-tight transition-all duration-300',
                      isActive
                        ? 'text-orange-600'
                        : isHovered
                          ? 'text-orange-500'
                          : 'text-gray-700'
                    )}
                  >
                    {section.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
