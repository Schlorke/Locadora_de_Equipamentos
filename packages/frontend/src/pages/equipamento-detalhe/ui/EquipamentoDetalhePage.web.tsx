'use client'
import {
  buildSharePayload,
  type EquipmentDetailProps,
} from '../model/detail-contract'
export { buildSharePayload } from '../model/detail-contract'

import { motion } from 'framer-motion'
import { EquipamentoGaleria } from './EquipamentoGaleria.web'
import { CategoryBadge } from '../../../entities/categoria'
import { SmartEquipmentPricing } from './EquipamentoPreco.web'
import { EquipmentBreadcrumb } from './EquipamentoTrilha.web'
import { EquipamentoVoltar } from './EquipamentoVoltar.web'
import { useState, type ReactNode } from 'react'
import {
  CheckCircle,
  Share2,
  Shield,
  Star,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { themes } from '@gb-locacoes/design-tokens'
import { useIdentidadePublica } from '../../../entities/organizacao'
import {
  DETALHE_INCLUIDO,
  DETALHE_TOPO,
  comCompromissosDeclarados,
  compromissosDeclarados,
  detalhePorQueEscolher,
  usePublicSettings,
} from '../../../entities/configuracao'
import { anosNoMercado, notaDaLocadora } from '../model/avaliacoes'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../shared/ui'

export function EquipmentInclusionItem({
  iconColor,
  text,
}: {
  iconColor: 'green' | 'blue' | 'orange'
  text: string
}) {
  const [isHovered, setIsHovered] = useState(false)
  const iconColorClass = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
  }

  return (
    <div
      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CheckCircle className={`h-5 w-5 ${iconColorClass[iconColor]}`} />
      <span
        className="font-medium transition-colors duration-300"
        style={{
          color: isHovered
            ? themes.light.primary
            : '#374151' /* token-check-allow: gray-700 do texto do item incluso, ainda fora da paleta */,
        }}
      >
        {text}
      </span>
    </div>
  )
}

function AnimatedMainCard({
  children,
  delay = 0,
}: {
  children: ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedSection({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function AnimatedBenefit({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Ícone e cor de cada promessa do topo (os de 55763c1e). */
const VISUAL_DO_TOPO: Record<string, { icon: LucideIcon; className: string }> =
  {
    certificado: { icon: Shield, className: 'h-4 w-4 text-green-400' },
    entrega: { icon: Truck, className: 'h-4 w-4 text-blue-400' },
    suporte: { icon: CheckCircle, className: 'h-4 w-4 text-orange-400' },
  }

/** Cor do ícone de cada item de "Incluído na locação" (as de 55763c1e). */
const COR_DO_INCLUIDO: Record<string, 'green' | 'blue' | 'orange'> = {
  manutencao: 'green', // token-check-allow: chave Tailwind green do item incluso
  suporte: 'blue', // token-check-allow: chave Tailwind blue do item incluso
  entrega: 'orange', // token-check-allow: chave Tailwind orange do item incluso
}

/** Ícone, gradiente e atraso de cada cartão do "Por que escolher" (os de 55763c1e). */
const VISUAL_DO_POR_QUE: Record<
  string,
  { icon: LucideIcon; gradiente: string; delay: number }
> = {
  certificados: {
    icon: Shield,
    gradiente: 'from-orange-500 to-orange-600',
    delay: 0.3,
  },
  entrega: { icon: Truck, gradiente: 'from-blue-500 to-blue-600', delay: 0.4 },
  suporte: {
    icon: CheckCircle,
    gradiente: 'from-green-500 to-green-600',
    delay: 0.5,
  },
}

function ShareButton({
  name,
  locadora,
}: {
  name: string
  locadora: string | null
}) {
  const [isSharing, setIsSharing] = useState(false)
  const [feedbackText, setFeedbackText] = useState('Compartilhar')

  const handleShare = async (): Promise<void> => {
    if (isSharing) return

    setIsSharing(true)

    const shareData = buildSharePayload(name, window.location.href, locadora)

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setFeedbackText('Link copiado!')
        setTimeout(() => {
          setFeedbackText('Compartilhar')
        }, 2000)
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error)
      alert(`Link para compartilhar: ${window.location.href}`)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={`bg-white border-gray-200 text-gray-500 hover:text-orange-600 transition-all duration-200 ${
        feedbackText === 'Link copiado!'
          ? 'text-green-600 border-green-200'
          : ''
      }`}
      onClick={handleShare}
      disabled={isSharing}
    >
      <Share2 className="h-4 w-4 mr-1" />
      <span className="text-xs">{feedbackText}</span>
    </Button>
  )
}

export function EquipamentoDetalhePage({
  name,
  description,
  categoryName,
  pricePerDay,
  available,
  structuredData,
  categorySlug,
  images,
  categoryIcon,
  categoryIconColor,
  categoryBgColor,
  categoryFontColor,
  categoryCustomIcon,
  equipmentId,
  dailyDiscount = 0,
  weeklyDiscount = 0,
  biweeklyDiscount = 0,
  monthlyDiscount = 0,
  popularPeriod = 'weekly',
  maxStock,
  dailyDirectValue = 0,
  weeklyDirectValue = 0,
  biweeklyDirectValue = 0,
  monthlyDirectValue = 0,
  dailyUseDirectValue = false,
  weeklyUseDirectValue = false,
  biweeklyUseDirectValue = false,
  monthlyUseDirectValue = false,
  dailyRentalEnabled = true,
  weeklyRentalEnabled = true,
  biweeklyRentalEnabled = true,
  monthlyRentalEnabled = true,
}: EquipmentDetailProps) {
  const priceLabel = pricePerDay.toFixed(2)
  // Nome e cidade da própria locadora (cartão público), nunca os da GB (achado 143).
  const identidade = useIdentidadePublica()
  const locadora = identidade?.nome ?? null
  // Onda 134: promessas, anos de mercado e nota só com o que a própria locadora declarou no painel (D-E e D-A).
  const { settings } = usePublicSettings()
  const declarados = compromissosDeclarados(settings.siteContent)
  const topo = comCompromissosDeclarados(declarados, DETALHE_TOPO)
  const incluido = comCompromissosDeclarados(declarados, DETALHE_INCLUIDO)
  const porQue = comCompromissosDeclarados(
    declarados,
    detalhePorQueEscolher(identidade?.cidade)
  )
  const anos = anosNoMercado(settings.siteContent?.experienceYears)
  const nota = notaDaLocadora(settings.siteContent)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/30">
      {structuredData}

      <div
        className="relative bg-gradient-to-b from-gray-900 via-gray-800 to-black overflow-hidden"
        style={{
          height:
            '184px' /* token-check-allow: altura fixa do hero do detalhe */,
        }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="pt-[3.1rem] mb-[2.05rem] hidden lg:block">
            <EquipmentBreadcrumb
              currentPage={name}
              categoryName={categoryName}
              categorySlug={categorySlug ?? undefined}
              variant="default"
              className="text-orange-100"
            />
          </nav>

          <div className="pt-8 md:pt-12 mb-4 md:mb-7 lg:hidden">
            <EquipamentoVoltar />
          </div>

          {topo.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-white/80 text-sm mb-2">
              {topo.map((frase) => {
                const visual = VISUAL_DO_TOPO[frase.chave]!
                const Icon = visual.icon
                return (
                  <div
                    key={frase.chave}
                    className="flex items-center gap-2 hover:text-orange-400 transition-colors duration-200 cursor-pointer"
                  >
                    <Icon className={visual.className} />
                    <span>{frase.texto}</span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <AnimatedMainCard>
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm mb-12 hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

            <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-3 gap-0">
              <div className="lg:col-span-2 p-4 sm:p-6 lg:p-12">
                <EquipamentoGaleria images={images} altText={name} />
              </div>

              <div className="bg-gradient-to-br from-gray-50/80 to-gray-100/40 p-4 sm:p-6 lg:p-10 space-y-6">
                <div className="flex items-center justify-between -mb-4">
                  <CategoryBadge
                    category={{
                      name: categoryName,
                      icon: (categoryIcon ?? null) as never,
                      iconColor: categoryIconColor ?? undefined,
                      bgColor: categoryBgColor ?? undefined,
                      fontColor: categoryFontColor ?? undefined,
                      customIcon: (categoryCustomIcon ?? null) as never,
                    }}
                    size="sm"
                    hover={false}
                  />
                  <ShareButton name={name} locadora={locadora} />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-3">
                    {name}
                  </h1>
                  {/* Nota com a fonte declarada pela locadora (D-A); a nota fixa da GB saiu (achado 143). */}
                  {nota ? (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={
                              star <= nota.estrelasCheias
                                ? 'h-4 w-4 fill-yellow-400 text-yellow-400'
                                : 'h-4 w-4 text-gray-300'
                            }
                          />
                        ))}
                        <span className="font-semibold text-sm ml-1">
                          {nota.nota}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        ({nota.quantidade} no{' '}
                        <a
                          href={nota.url}
                          rel="nofollow noopener"
                          target="_blank"
                          className="underline hover:text-orange-600"
                        >
                          {nota.fonte}
                        </a>
                        )
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {available ? (
                    <Badge className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 inline-flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-white shrink-0" />
                      <span>Disponível</span>
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs px-2 py-1">
                      Indisponível
                    </Badge>
                  )}
                </div>

                <SmartEquipmentPricing
                  equipmentId={equipmentId}
                  equipmentName={name}
                  pricePerDay={pricePerDay}
                  isAvailable={available}
                  dailyDiscount={dailyDiscount}
                  weeklyDiscount={weeklyDiscount}
                  biweeklyDiscount={biweeklyDiscount}
                  monthlyDiscount={monthlyDiscount}
                  popularPeriod={popularPeriod}
                  maxStock={maxStock}
                  description={description ?? undefined}
                  category={{ name: categoryName }}
                  images={images}
                  dailyDirectValue={dailyDirectValue}
                  weeklyDirectValue={weeklyDirectValue}
                  biweeklyDirectValue={biweeklyDirectValue}
                  monthlyDirectValue={monthlyDirectValue}
                  dailyUseDirectValue={dailyUseDirectValue}
                  weeklyUseDirectValue={weeklyUseDirectValue}
                  biweeklyUseDirectValue={biweeklyUseDirectValue}
                  monthlyUseDirectValue={monthlyUseDirectValue}
                  dailyRentalEnabled={dailyRentalEnabled}
                  weeklyRentalEnabled={weeklyRentalEnabled}
                  biweeklyRentalEnabled={biweeklyRentalEnabled}
                  monthlyRentalEnabled={monthlyRentalEnabled}
                />
              </div>
            </div>
          </Card>
        </AnimatedMainCard>

        <AnimatedSection
          delay={0.1}
          className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8 mb-12"
        >
          {description ? (
            <div className="lg:col-span-2">
              <Card className="relative h-full overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

                <CardHeader className="relative z-10 p-4 md:px-6 md:pt-6">
                  <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900">
                    Sobre este equipamento
                  </CardTitle>
                </CardHeader>
                <div className="border-b border-gray-100 w-full"></div>
                <CardContent className="relative z-10 px-4 sm:p-6 lg:p-6">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-[16px] ">
                    {description}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div>
            <Card className="relative h-full overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

              <CardHeader className="relative z-10 p-4 lg:px-6 lg:pt-6">
                <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900">
                  Informações
                </CardTitle>
              </CardHeader>
              <div className="border-b border-gray-100 px-4 sm:px-6 lg:px-6"></div>
              <CardContent className="relative z-10 space-y-6 px-4 sm:p-6 lg:p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Categoria</span>
                    <span className="font-semibold text-gray-900">
                      {categoryName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">
                      Preço diário
                    </span>
                    <span className="font-bold text-orange-600 text-lg">
                      R$ {priceLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Status</span>
                    <Badge
                      className={`text-sm px-3 py-1 shadow-sm transition-colors duration-200 ${available ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                    >
                      {available ? 'Disponível' : 'Indisponível'}
                    </Badge>
                  </div>
                </div>

                {incluido.length > 0 ? (
                  <div className="pt-4 space-y-4">
                    <h4 className="font-semibold text-base text-gray-900">
                      Incluído na locação:
                    </h4>
                    <div className="space-y-3">
                      {incluido.map((item) => (
                        <EquipmentInclusionItem
                          key={item.chave}
                          iconColor={COR_DO_INCLUIDO[item.chave]!}
                          text={item.texto}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </AnimatedSection>

        {porQue.length > 0 ? (
          <AnimatedSection delay={0.2}>
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 text-white mb-8 hover:shadow-2xl transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/30 via-transparent to-gray-900/40"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-700/10 to-slate-800/30"></div>

              <CardContent className="relative z-10 p-4 sm:p-6 lg:p-12">
                <div className="text-center mb-6 lg:mb-8">
                  <h3 className="text-xl sm:text-2xl font-bold mb-3">
                    Por que escolher{' '}
                    {locadora ? `a ${locadora}` : 'a nossa locadora'}?
                  </h3>
                  {anos ? (
                    <p className="text-gray-300 text-sm">{anos}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                  {porQue.map((cartao) => {
                    const visual = VISUAL_DO_POR_QUE[cartao.chave]!
                    const Icon = visual.icon
                    return (
                      <AnimatedBenefit
                        key={cartao.chave}
                        delay={visual.delay}
                        className="text-center group"
                      >
                        <div
                          className={`w-16 h-16 bg-gradient-to-br ${visual.gradiente} rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300`}
                        >
                          <Icon className="h-8 w-8 text-white" />
                        </div>
                        <h4 className="font-semibold mb-2 group-hover:text-orange-500 transition-colors duration-300">
                          {cartao.titulo}
                        </h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {cartao.descricao}
                        </p>
                      </AnimatedBenefit>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        ) : null}
      </div>
    </main>
  )
}
