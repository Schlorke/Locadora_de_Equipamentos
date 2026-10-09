'use client'

import {
  CategoryShowcase,
  type CategoryItem,
  type TabConfig,
} from '../../../features/abas-categoria'
import { LayoutGroup, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import { EquipmentInfiniteScroll } from './ScrollInfinito.web'
import type { CustomIconProps } from '@gb-locacoes/ui'
import { renderIcon } from '../../../shared/lib/constants/all-icons'
import { normalizeIconName } from '../../../shared/lib/icon-utils'
import RotatingText from './RotatingText.web'
import { renderCategoryIcon } from '../../../shared/lib/category-design'
import type { CategoryDesign, CustomIconConfig } from '../../../shared/lib/category-design'
import type * as LucideIcons from 'lucide-react'

interface ApiCategory {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  iconColor?: string
  bgColor?: string
  fontColor?: string
  slug: string
  placement?: 'phases' | 'types' | null
  customIcon?: CustomIconConfig | null
  _count?: {
    equipments: number
  }
}

// Função para criar um componente de ícone a partir do nome e customIcon
function createIconComponent(
  iconName: string | null | undefined,
  customIcon?: CustomIconConfig | null,
  iconColor?: string
): React.ComponentType<CustomIconProps> {
  const normalized = normalizeIconName(iconName)
  const defaultIcon = 'Tag'

  return function CategoryIcon({ size = 28, color = 'white', className }) {
    // Se há customIcon, usar renderCategoryIcon que suporta SVGs
    if (customIcon && customIcon.source !== 'none') {
      const design: CategoryDesign = {
        backgroundColor: '#3b82f6', // token-check-allow: azul padrão do ícone de categoria
        fontColor: '#ffffff', // token-check-allow: texto branco do ícone de categoria
        iconColor: iconColor || color,
        icon:
          (normalized as keyof typeof LucideIcons) ||
          (defaultIcon as keyof typeof LucideIcons),
        customIcon: customIcon || { source: 'none' },
        placement: 'types',
      }
      return renderCategoryIcon(design, { size, color, className })
    }

    // Fallback para ícones Lucide
    const iconToRender = normalized || defaultIcon
    const rendered = renderIcon(iconToRender, size, color, className)
    return (
      rendered || (
        <div className={className} style={{ width: size, height: size }} />
      )
    )
  }
}

// Limite de categorias por tab
const MAX_CATEGORIES_PER_TAB = 12

export default function EquipmentShowcaseSection() {
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Buscar categorias da API
  useEffect(() => {
    async function fetchCategories() {
      try {
        setIsLoading(true)
        const res = await fetch('/api/categories')
        if (!res.ok) {
          console.error('Erro ao buscar categorias:', res.statusText)
          return
        }
        const data: ApiCategory[] = await res.json()
        setCategories(data)
      } catch (err) {
        console.error('Erro ao buscar categorias:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCategories()
  }, [])

  // Construir tabs com filtros
  const tabsConfig: TabConfig[] = useMemo(() => {
    const safeCategories = Array.isArray(categories)
      ? categories.filter((cat): cat is ApiCategory =>
          Boolean(cat && cat.id && cat.name)
        )
      : []

    // Converter categorias da API para CategoryItem
    const convertToCategoryItem = (cat: ApiCategory): CategoryItem => ({
      id: cat.id,
      name: cat.name,
      icon: createIconComponent(cat.icon, cat.customIcon, cat.iconColor),
    })

    // Tab "Categorias" - mostra TODAS as categorias (limitado a 12)
    const allCategories = safeCategories
      .map(convertToCategoryItem)
      .slice(0, MAX_CATEGORIES_PER_TAB)

    // Tab "Fases da Obra" - apenas categorias com placement='phases' (limitado a 12)
    const phasesFiltered = safeCategories.filter((cat) => {
      // Verificação robusta: aceita string 'phases' ou comparação estrita
      const placement = cat.placement
      return placement === 'phases' || String(placement) === 'phases'
    })
    const phasesCategories = phasesFiltered
      .map(convertToCategoryItem)
      .slice(0, MAX_CATEGORIES_PER_TAB)

    // Tab "Tipo de Trabalho" - apenas categorias com placement='types' (limitado a 12)
    const typesFiltered = safeCategories.filter((cat) => {
      // Verificação robusta: aceita string 'types' ou comparação estrita
      const placement = cat.placement
      return placement === 'types' || String(placement) === 'types'
    })
    const typesCategories = typesFiltered
      .map(convertToCategoryItem)
      .slice(0, MAX_CATEGORIES_PER_TAB)

    return [
      {
        value: 'mais-alugados',
        label: 'Categorias',
        categories: allCategories,
      },
      {
        value: 'fases-obra',
        label: 'Fases da obra',
        categories: phasesCategories,
      },
      {
        value: 'tipo-trabalho',
        label: 'Tipo de trabalho',
        categories: typesCategories,
      },
    ]
  }, [categories])

  const handleCategoryClick = (category: CategoryItem) => {
    // Navegar para página de equipamentos filtrados por categoria
    window.location.href = `/equipamentos?categoria=${category.id}`
  }

  // Não renderizar enquanto carrega (ou renderizar um loading state)
  if (isLoading) {
    return (
      <section className="bg-gray-50 pt-12 md:pt-16 lg:pt-20 pb-12 md:pb-16 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-slate-600">Carregando categorias...</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-gray-50 pt-12 md:pt-16 lg:pt-20 [--section-bottom:theme(spacing.12)] md:[--section-bottom:theme(spacing.16)] lg:[--section-bottom:theme(spacing.20)] [--shadow-offset:theme(spacing.16)] pb-[max(0px,calc(var(--section-bottom)-var(--shadow-offset)))] overflow-y-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Layout de duas colunas responsivo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda (Desktop) / Embaixo (Mobile): Scroll Infinito */}
          {/* Sticky removido: causava bug de scroll vertical no iOS Safari */}
          <div className="order-2 lg:order-1">
            <EquipmentInfiniteScroll />
          </div>

          {/* Coluna Direita (Desktop) / Topo (Mobile): Tabs */}
          <div className="order-1 lg:order-2 relative z-20">
            {/* Header com título */}
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 leading-tight">
                <LayoutGroup>
                  <motion.span className="flex flex-col gap-1" layout>
                    <motion.span
                      layout
                      transition={{
                        type: 'spring',
                        damping: 30,
                        stiffness: 400,
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <motion.span
                        layout
                        transition={{
                          type: 'spring',
                          damping: 30,
                          stiffness: 400,
                        }}
                        className="leading-tight"
                      >
                        Tecnologia
                      </motion.span>
                      <RotatingText
                        texts={['sob medida', 'certa', 'eficiente'] /* token-check-allow: slate-700 do texto giratório da vitrine */}
                        mainClassName="inline-flex items-center justify-center rounded-lg bg-[#334155] px-2 py-1 text-white md:px-3 md:py-1.5"
                        splitLevelClassName="inline-flex items-center"
                        elementLevelClassName="inline-block"
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '-120%', opacity: 0 }}
                        staggerDuration={0.05}
                        staggerFrom="last"
                        rotationInterval={3200}
                        transition={{
                          type: 'spring',
                          damping: 30,
                          stiffness: 400,
                        }}
                        aria-label="Palavras que descrevem a tecnologia da locadora"
                      />
                    </motion.span>
                    <span className="block leading-tight text-slate-900">
                      para cada fase da sua obra
                    </span>
                  </motion.span>
                </LayoutGroup>
              </h2>
              <p className="text-slate-600 text-base">
                Escolha por categoria para encontrar o equipamento ideal
              </p>
            </div>

            {/* Componente CategoryShowcase */}
            <CategoryShowcase
              tabs={tabsConfig}
              defaultTab="mais-alugados"
              onCategoryClickAction={handleCategoryClick}
              gridCols={{
                base: 2,
                sm: 2,
                md: 3,
                lg: 4,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
