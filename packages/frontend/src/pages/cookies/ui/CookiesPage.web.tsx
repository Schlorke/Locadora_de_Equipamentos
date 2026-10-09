'use client'
import { DocumentContent } from '@gb-locacoes/ui'
import { sections, documentBlocks } from '../model/document-content'

import { motion } from 'framer-motion'
import { CheckCircle, ChevronRight, Cookie, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '../../../shared/ui'
import { ContactInfoCard } from '../../../widgets/contato-empresa'
import {
  ComMolduraDaPausa,
  type MolduraDaPausa,
} from '../../../widgets/site-pausado'

const documentComponents = { Card, CardContent, ContactInfoCard, CheckCircle }

/**
 * Política de Cookies (texto da plataforma). Em pausa, continua no ar (onda 134; decisão do dono de 2026-10-06, item 4)
 * dentro da moldura neutra da locadora (`moldura`, S13).
 */
export function CookiesPage({
  moldura = null,
}: {
  /** Moldura neutra da locadora em pausa (S13); sem ela, a página fica na moldura da vitrine. */
  moldura?: MolduraDaPausa | null
}) {
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => {
      if (typeof document === 'undefined' || typeof window === 'undefined')
        return
      let closestSection = sections[0]?.id || ''
      let closestDistance = Infinity

      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (element) {
          const rect = element.getBoundingClientRect()
          const distanceFromTop = Math.abs(rect.top - 150)

          if (distanceFromTop < closestDistance) {
            closestDistance = distanceFromTop
            closestSection = section.id
          }
        }
      }

      setActiveSection(closestSection)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    const element = document.getElementById(id)
    if (element) {
      const offset = 120
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  return (
    <ComMolduraDaPausa moldura={moldura}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="sticky top-24"
              >
                <Card className="relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent opacity-30"></div>
                  <div className="relative z-10 p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                        Índice
                      </h3>
                    </div>
                  </div>
                  <CardContent className="p-0 relative z-10">
                    <nav className="space-y-1 p-4">
                      {sections.map((section, index) => (
                        <motion.div
                          key={section.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <button
                            onClick={() => scrollToSection(section.id)}
                            className={`group flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-xl transition-colors duration-200 ${
                              activeSection === section.id
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-orange-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs ${
                                  activeSection === section.id
                                    ? 'text-white'
                                    : 'text-gray-400 group-hover:text-orange-600'
                                }`}
                              >
                                {index + 1}.
                              </span>
                              <span className="text-left">{section.title}</span>
                            </div>
                            <ChevronRight
                              className={`h-4 w-4 transition-colors duration-200 ${
                                activeSection === section.id
                                  ? 'text-white'
                                  : 'text-gray-400 group-hover:text-orange-600'
                              }`}
                            />
                          </button>
                        </motion.div>
                      ))}
                    </nav>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <div className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="min-h-screen bg-gray-50 pt-[84px] sm:pt-0">
                  <section className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white overflow-hidden w-screen -ml-4 sm:w-full sm:ml-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 lg:py-14 relative z-10">
                      <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 shadow-xl">
                          <Cookie className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold leading-tight">
                          Política de Cookies
                        </h1>
                        <p className="text-[18px] text-white leading-relaxed max-w-2xl mx-auto">
                          Entenda como utilizamos cookies para melhorar sua
                          experiência
                        </p>
                        <p className="text-sm text-orange-100">
                          Última atualização: 23 de Junho de 2025
                        </p>
                      </div>
                    </div>
                    <div className="relative w-full overflow-hidden">
                      <svg
                        className="relative block w-full h-6"
                        data-name="Layer 1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 1200 120"
                        preserveAspectRatio="none"
                      >
                        <path
                          d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z"
                          fill={
                            '#f9fafb' /* token-check-allow: onda SVG da página de cookies; gray-50 ainda não está na paleta */
                          }
                        />
                      </svg>
                    </div>
                  </section>

                  <section className="py-12 md:py-16 lg:py-10 relative -mt-20 md:-mt-24">
                    <div className="sm:px-6 lg:px-8 max-w-7xl mx-auto">
                      <div className="space-y-6">
                        <DocumentContent
                          node={documentBlocks[0]!}
                          components={documentComponents}
                        />

                        <DocumentContent
                          node={documentBlocks[1]!}
                          components={documentComponents}
                        />

                        <DocumentContent
                          node={documentBlocks[2]!}
                          components={documentComponents}
                        />

                        <DocumentContent
                          node={documentBlocks[3]!}
                          components={documentComponents}
                        />

                        <DocumentContent
                          node={documentBlocks[4]!}
                          components={documentComponents}
                        />

                        <DocumentContent
                          node={documentBlocks[5]!}
                          components={documentComponents}
                        />

                        <DocumentContent
                          node={documentBlocks[6]!}
                          components={documentComponents}
                        />

                        <DocumentContent
                          node={documentBlocks[7]!}
                          components={documentComponents}
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </ComMolduraDaPausa>
  )
}
