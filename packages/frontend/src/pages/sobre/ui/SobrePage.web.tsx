'use client'

import type { ReactNode } from 'react'
import { Card, CardContent } from '../../../shared/ui'
import {
  anos,
  comMais,
  decadas,
  maisAntes,
  usePublicSettings,
} from '../../../entities/configuracao'
import { useIdentidadePublica } from '../../../entities/organizacao'
import {
  Award,
  Building,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Shield,
  Target,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

export type SobreEquipmentModel = {
  id: string
  name: string
  modelUrl: string
  description: string
}

export type SobreCarouselProps = {
  models: SobreEquipmentModel[]
  autoRotate: boolean
  autoRotateInterval: number
  className: string
  height: string
  isRevealComplete: boolean
}

const SOBRE_EQUIPMENT_MODELS: SobreEquipmentModel[] = [
  {
    id: 'compressor',
    name: 'Compressor de Ar',
    modelUrl: '/models/Compressor.glb',
    description: 'Compressores de alta pressão',
  },
  {
    id: 'betoneira',
    name: 'Betoneira',
    modelUrl: '/models/Betoneira.glb',
    description: 'Betoneiras para preparo de concreto',
  },
  {
    id: 'andaime',
    name: 'Andaime',
    modelUrl: '/models/Andaime.glb',
    description: 'Andaimes para trabalhos em altura',
  },
]

const values = [
  {
    icon: Shield,
    title: 'Qualidade Garantida',
    description: 'Equipamentos modernos e bem mantidos para máxima segurança',
    color: 'orange', // token-check-allow: chave Tailwind orange já usada no card de valor
  },
  {
    icon: Clock,
    title: 'Pontualidade',
    description: 'Entregas sempre no prazo acordado',
    color: 'blue', // token-check-allow: chave Tailwind blue já usada no card de valor
  },
  {
    icon: Target,
    title: 'Foco no Cliente',
    description: 'Atendimento personalizado para cada necessidade',
    color: 'green', // token-check-allow: chave Tailwind green já usada no card de valor
  },
  {
    icon: Award,
    title: 'Excelência',
    description: 'Comprometimento com a qualidade em todos os serviços',
    color: 'purple', // token-check-allow: chave Tailwind purple já usada no card de valor
  },
]

type NumeroDaSobre = {
  icon: LucideIcon
  number: string
  label: string
  description: string
  color: string
}

/**
 * Página "Sobre" da vitrine (achado 143; onda 134): o nome e a cidade do cartão, o texto "Sobre nós" e o conteúdo
 * institucional que a própria locadora declarou no painel (`settings.siteContent`), na marcação de 55763c1e. Cada bloco
 * aparece só com o dado dele: números (anos, clientes, frota, cidades), história, selos em volta do carrossel, "Nossa
 * Jornada" e o selo do Google Avaliações do Consumidor (com o ID do Merchant Center dela). Sem dado, omissão.
 */
export function SobrePage({
  carousel,
  badge = null,
}: {
  carousel: (props: SobreCarouselProps) => ReactNode
  /**
   * Selo do Google Avaliações do Consumidor com o ID do Merchant Center da própria locadora. Sem o ID (ou sem o nome
   * da locadora, que o texto da seção cita), a seção não aparece.
   */
  badge?: ((merchantId: string) => ReactNode) | null
}) {
  const [isReady, setIsReady] = useState(false)
  const [isScrollRevealReady, setIsScrollRevealReady] = useState(false)
  const { settings, isLoading } = usePublicSettings()
  const identidade = useIdentidadePublica()
  const nome = identidade?.nome ?? null
  const cidade = identidade?.cidade?.trim() || null
  // Telefone e WhatsApp do CTA, cada um só quando informado: o "|" só entre os dois e, sem nenhum, o botão sai
  // (carregando, fica no lugar, sem número nem "|").
  const telefone = settings.companyPhone.trim()
  const whatsapp = settings.whatsappNumber.trim()
  const conteudo = settings.siteContent
  const anosDeMercado = conteudo.experienceYears ?? null
  const clientes = conteudo.clientsServed ?? null
  const frota = conteudo.fleetSize ?? null
  const cidadesAtendidas = conteudo.citiesServed ?? null
  // Primeiro parágrafo de "Nossa História": a história declarada; sem ela, o texto "Sobre nós" (como antes).
  const historia =
    conteudo.history?.trim() || settings.aboutUsText?.trim() || null
  const linhaDoTempo = conteudo.timeline ?? []
  const merchantId = conteudo.googleMerchantId ?? null
  const subtitulo = `${
    cidade
      ? `Em ${cidade} e região, oferecendo soluções em equipamentos para construção civil`
      : 'Soluções em equipamentos para construção civil'
  }${anosDeMercado ? ` há mais de ${anos(anosDeMercado)}` : ''}`
  const stats: NumeroDaSobre[] = [
    ...(anosDeMercado
      ? [
          {
            icon: Calendar,
            number: comMais(anosDeMercado),
            label: 'Anos de Experiência',
            description: `${decadas(anosDeMercado)} atendendo o mercado da construção civil`,
            color: 'from-orange-500 to-orange-600',
          },
        ]
      : []),
    ...(clientes
      ? [
          {
            icon: Users,
            number: comMais(clientes),
            label: 'Clientes Satisfeitos',
            description:
              'Empresas e profissionais que confiam em nossos serviços',
            color: 'from-blue-500 to-blue-600',
          },
        ]
      : []),
    ...(frota
      ? [
          {
            icon: Wrench,
            number: comMais(frota),
            label: 'Equipamentos',
            description:
              'Ampla variedade de equipamentos para todas as necessidades',
            color: 'from-green-500 to-green-600',
          },
        ]
      : []),
    ...(cidadesAtendidas
      ? [
          {
            icon: MapPin,
            number: comMais(cidadesAtendidas),
            label: 'Cidades Atendidas',
            description: cidade
              ? `Cobertura em ${cidade} e região metropolitana`
              : 'Cobertura na região',
            color: 'from-purple-500 to-purple-600',
          },
        ]
      : []),
  ]

  useEffect(() => {
    // Pequeno delay para garantir que tudo esteja carregado
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Aguardar scroll-reveal-init estar pronto para sincronizar animações 3D
  useEffect(() => {
    const handleScrollRevealReady = () => {
      setIsScrollRevealReady(true)
    }

    window.addEventListener('scrollRevealReady', handleScrollRevealReady)

    return () => {
      window.removeEventListener('scrollRevealReady', handleScrollRevealReady)
    }
  }, [])

  return (
    <div
      className={`sobre-page min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 transition-opacity duration-300 ${!isReady ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header com gradiente - seguindo padrão das outras páginas */}
        <div className="mb-8">
          <div
            className="sobre-header-block relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl"
            style={{ opacity: 0 }}
          >
            {/* Clean depth layers */}
            <div className="absolute inset-0"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>

            {/* Content */}
            <div className="relative z-10 text-center">
              <h1 className="section-title text-3xl font-bold mb-2 text-white drop-shadow-sm">
                {nome ? `Sobre a ${nome}` : 'Sobre nós'}
              </h1>
              <p className="section-subtitle text-orange-50 mb-4 font-medium">
                {subtitulo}
              </p>
              <div className="hero-search flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit mx-auto">
                <Building className="w-5 h-5 text-orange-50" />
                <span className="font-semibold text-white">
                  Referência em locação de equipamentos
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section: só os números que a locadora declarou */}
        {stats.length > 0 ? (
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat) => {
                const IconComponent = stat.icon
                return (
                  <Card
                    key={stat.label}
                    className="material-card relative overflow-hidden border-0 bg-white shadow-lg hover:shadow-xl hover:scale-[1.02] group rounded-2xl motion-safe:opacity-0"
                  >
                    {/* Background gradient */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity rounded-2xl`}
                    ></div>

                    <CardContent className="p-6 text-center relative z-10">
                      <div
                        className={`w-16 h-16 rounded-full bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}
                      >
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-2">
                        {stat.number}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {stat.label}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Nossa História Section */}
        <div className="mb-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="hero-title">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Nossa História
              </h2>
              <div className="space-y-4 text-gray-600">
                {historia ? (
                  <p className="text-lg leading-relaxed">{historia}</p>
                ) : null}
                <p className="leading-relaxed">
                  Com uma frota moderna e bem mantida, atendemos desde pequenas
                  reformas até grandes obras, sempre com o compromisso de
                  entregar equipamentos em perfeito estado de funcionamento.
                </p>
                <p className="leading-relaxed">
                  Nossa equipe especializada está sempre pronta para orientar
                  sobre o melhor equipamento para cada tipo de trabalho,
                  garantindo eficiência e segurança em seus projetos.
                </p>
              </div>
            </div>

            <div className="hero-image relative px-0 sm:px-0 md:px-8">
              {/* Container do componente 3D com cards flutuantes - estilo da homepage */}
              <div className="hero-image group relative w-full lg:w-[540px] aspect-square mx-auto rounded-2xl">
                {/* Wrapper interno com backdrop-filter, opacity e scale */}
                <div
                  className="hero-image-inner relative h-full w-full rounded-2xl duration-500 group-hover:scale-[1.04]"
                  style={{
                    opacity: 0,
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  }}
                >
                  {carousel({
                    models: SOBRE_EQUIPMENT_MODELS,
                    autoRotate: true,
                    autoRotateInterval: 6000,
                    className: 'transform transition-transform duration-500',
                    height: '100%',
                    isRevealComplete: isScrollRevealReady,
                  })}
                </div>

                {/* Cards flutuantes ao redor do componente 3D, cada um só com o número da locadora */}
                {/* Card 1: frota - Estilo amarelo da homepage - bottom-left */}
                {frota ? (
                  <div
                    className="hero-badge-left hidden sm:block absolute -bottom-2 -left-2 bg-yellow-500 text-gray-900 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer z-20"
                    style={{ opacity: 0 }}
                  >
                    <div className="text-2xl font-bold animate-count-up">
                      {maisAntes(frota)}
                    </div>
                    <div className="text-sm font-medium">
                      Equipamentos Disponíveis
                    </div>
                  </div>
                ) : null}

                {/* Card 2: anos de mercado - Estilo branco/laranja da homepage - top-right */}
                {anosDeMercado ? (
                  <div
                    className="hero-badge-right hidden sm:block absolute -top-2 -right-2 bg-white/90 backdrop-blur-sm text-orange-600 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer z-20"
                    style={{ opacity: 0 }}
                  >
                    <div className="text-2xl font-bold">
                      {comMais(anosDeMercado)}
                    </div>
                    <div className="text-sm font-medium">
                      Anos de Experiência
                    </div>
                  </div>
                ) : null}

                {/* Card 3: clientes - Estilo similar ao segundo - top-left para não conflitar */}
                {clientes ? (
                  <div
                    className="hero-badge-top-left hidden sm:block absolute -top-2 -left-2 bg-white/90 backdrop-blur-sm text-orange-600 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer z-20"
                    style={{ opacity: 0 }}
                  >
                    <div className="text-2xl font-bold">
                      {comMais(clientes)}
                    </div>
                    <div className="text-sm font-medium">
                      Clientes Satisfeitos
                    </div>
                  </div>
                ) : null}

                {/* Border animado */}
                <div
                  className="hero-border absolute inset-[-1rem] border-2 border-white/20 rounded-2xl animate-pulse pointer-events-none group-hover:scale-105 transform transition-transform"
                  style={{ opacity: 0 }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Nossos Valores Section */}
        <div className="mb-12">
          <div className="text-center mb-12">
            <h2 className="section-title text-3xl font-bold text-gray-900 mb-4">
              Nossos Valores
            </h2>
            <p className="section-subtitle text-gray-600 text-lg max-w-2xl mx-auto">
              Os princípios que nos guiam em cada projeto e relacionamento com
              nossos clientes
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => {
              const IconComponent = value.icon
              return (
                <Card
                  key={value.title}
                  className="benefit-card relative overflow-hidden border-0 bg-white shadow-lg hover:shadow-xl hover:scale-[1.02] group h-full rounded-2xl motion-safe:opacity-0"
                >
                  <CardContent className="p-6 text-center">
                    <div
                      className={`w-12 h-12 rounded-full bg-${value.color}-100 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <IconComponent
                        className={`w-6 h-6 text-${value.color}-600`}
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {value.title}
                    </h3>
                    <p className="text-sm text-gray-600">{value.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Timeline Section: só com a linha do tempo da locadora */}
        {linhaDoTempo.length > 0 ? (
          <div className="mb-12">
            <div className="text-center mb-12">
              <h2 className="section-title text-3xl font-bold text-gray-900 mb-4">
                Nossa Jornada
              </h2>
              <p className="section-subtitle text-gray-600 text-lg">
                {nome
                  ? `A evolução da ${nome} ao longo dos anos`
                  : 'A nossa evolução ao longo dos anos'}
              </p>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-orange-300 hidden md:block"></div>

              <div className="space-y-8">
                {linhaDoTempo.map((item) => (
                  <div
                    key={`${item.year}-${item.title}`}
                    className="material-card relative flex items-start motion-safe:opacity-0"
                  >
                    {/* Timeline dot */}
                    <div className="shrink-0 w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg mr-6 relative z-10">
                      {String(item.year)}
                    </div>

                    {/* Content */}
                    <Card className="flex-1 border-0 bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group overflow-hidden rounded-lg">
                      <CardContent className="p-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-gray-600">{item.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Selo Google Avaliações do Consumidor: só com o ID do Merchant Center e o nome da própria locadora. */}
        {badge && merchantId && nome ? (
          <div className="mb-12">
            <Card className="material-card relative overflow-hidden border-0 bg-white shadow-lg hover:shadow-xl rounded-2xl motion-safe:opacity-0">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Avaliação verificada pelo Google
                </h3>
                <p className="text-sm text-gray-600 max-w-md">
                  {`A ${nome} participa do programa Google Avaliações do Consumidor. Confira a opinião dos nossos clientes.`}
                </p>
                {badge(merchantId)}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* CTA Section */}
        <div className="text-center">
          <Card className="cta-section relative overflow-hidden border-0 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-xl motion-safe:opacity-0">
            {/* Background pattern */}
            <div className="absolute inset-0"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>

            <CardContent className="relative z-10 p-12 text-center text-white">
              <Building className="w-16 h-16 mx-auto mb-6 text-orange-100" />
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Pronto para começar seu projeto?
              </h3>
              <p className="text-orange-100 mb-8 text-lg max-w-2xl mx-auto">
                Entre em contato conosco e descubra como podemos ajudar a tornar
                sua obra mais eficiente e segura.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a
                  href="/orcamento"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-white text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  <Target className="w-5 h-5" />
                  Solicitar Orçamento
                </a>
                {telefone || whatsapp || isLoading ? (
                  <div className="inline-flex items-center gap-3 px-8 py-3 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/30 transition-all duration-300 hover:scale-105 border border-white/30">
                    <Phone className="w-5 h-5" />
                    {telefone ? (
                      <a
                        href={`tel:+55${telefone.replace(/\D/g, '')}`}
                        className="hidden sm:inline hover:underline"
                      >
                        {telefone}
                      </a>
                    ) : null}
                    {telefone && whatsapp ? (
                      <span className="hidden sm:inline text-white/70">|</span>
                    ) : null}
                    {whatsapp ? (
                      <a
                        href={`tel:+55${whatsapp.replace(/\D/g, '')}`}
                        className="hover:underline"
                      >
                        {whatsapp}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
