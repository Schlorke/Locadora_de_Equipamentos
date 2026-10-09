'use client'

import BlurText from './BlurText.web'
import { ScrollStackBenefitCard } from './ScrollStackBenefitCard.web'
import ScrollStack, { ScrollStackItem } from './ScrollStack.web'
import { usePublicSettings } from '../../../entities/configuracao'
import { useIdentidadePublica } from '../../../entities/organizacao'
import { useState } from 'react'
import {
  Award,
  Clock,
  Headphones,
  Shield,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  beneficiosDaLocadora,
  type ChaveDoBeneficio,
  type ConteudoDosBeneficios,
} from '../model/beneficios'

/** Ícone e cor de cada benefício (os mesmos de antes). */
const VISUAL_DO_BENEFICIO: Record<
  ChaveDoBeneficio,
  { icon: LucideIcon; accentColor: string }
> = {
  certificados: { icon: Shield, accentColor: 'from-blue-500 to-blue-600' },
  entrega: { icon: Truck, accentColor: 'from-green-500 to-green-600' },
  atendimento: { icon: Clock, accentColor: 'from-purple-500 to-purple-600' },
  construtoras: { icon: Users, accentColor: 'from-orange-500 to-orange-600' },
  anos: { icon: Award, accentColor: 'from-yellow-500 to-yellow-600' },
  rastreamento: { icon: Headphones, accentColor: 'from-red-500 to-red-600' },
}

/** Benefícios da locadora (texto do modelo, cidade e conteúdo dela) com o ícone e a cor de cada um. */
export function beneficiosComVisual(
  cidade: string | null,
  conteudo?: ConteudoDosBeneficios | null
) {
  return beneficiosDaLocadora(cidade, conteudo).map((beneficio) => ({
    ...beneficio,
    ...VISUAL_DO_BENEFICIO[beneficio.chave],
  }))
}

export default function WhyChooseUs() {
  const { settings, isLoading } = usePublicSettings()
  // Telefone e WhatsApp do CTA, cada um só quando informado: o "|" só entre os dois e, sem nenhum, o botão sai
  // (carregando, fica no lugar, sem número nem "|").
  const telefone = settings.companyPhone.trim()
  const whatsapp = settings.whatsappNumber.trim()
  // Nome e cidade da própria locadora no título, nos selos e na região de entrega (achado 143); sem eles, o texto
  // genérico. Construtoras, anos de mercado e compromissos só os que ela declarou no painel (onda 134).
  const identidade = useIdentidadePublica()
  const nome = identidade?.nome ?? null
  const benefits = beneficiosComVisual(
    identidade?.cidade ?? null,
    settings.siteContent
  )
  const [secondLineReady, setSecondLineReady] = useState(false)

  return (
    <section className="bg-gray-900 text-white relative min-h-screen overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      {/* Title and stack */}
      <div className="relative z-10 py-12 md:py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <BlurText
            text="Por que Escolher a"
            delay={150}
            animateBy="words"
            direction="top"
            className="section-title text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-4 justify-center"
            onAnimationCompleteAction={() => setSecondLineReady(true)}
          />
          <BlurText
            text={nome ? `${nome}?` : 'nossa locadora?'}
            delay={150}
            animateBy="words"
            direction="top"
            className="section-title text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-4 justify-center"
            shouldStartAnimating={secondLineReady}
          />
        </div>

        <div className="mt-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollStack
            useWindowScroll={true}
            itemDistance={300}
            itemScale={0.025}
            itemStackDistance={30}
            stackPosition="20%"
            scaleEndPosition="15%"
            baseScale={0.85}
            blurAmount={0}
            onStackComplete={() => {
              // Stack animation completed
            }}
          >
            {benefits.map((benefit, index) => (
              <ScrollStackItem
                key={benefit.title}
                itemClassName="bg-gradient-to-br from-gray-800/95 backdrop-blur-xl border border-gray-700/50 shadow-[0_0_40px_rgba(234,88,12,0.12)]"
              >
                <ScrollStackBenefitCard
                  icon={benefit.icon}
                  title={benefit.title}
                  description={benefit.description}
                  accentColor={benefit.accentColor}
                  index={index}
                  marca={nome}
                />
              </ScrollStackItem>
            ))}
          </ScrollStack>
        </div>
      </div>

      {/* CTA Section - after scroll stack */}
      <div className="relative z-20 pt-0 pb-8 md:py-16 lg:py-20 bg-gradient-to-b from-transparent via-gray-900/55 to-gray-900">
        {/* Gradient fade mask to blend with cards above - smooth transition */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-transparent via-gray-900/30 to-gray-900 pointer-events-none z-10 backdrop-blur-md" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
          <div
            className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden"
            data-scroll-reveal="true"
            style={{
              backgroundImage: 'url(/cta-background.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: '100% 99%',
              backgroundRepeat: 'no-repeat',
            }}
            suppressHydrationWarning
          >
            {/* Badge no canto superior direito - oculta em mobile */}
            <div className="hidden md:inline-flex absolute top-6 right-6 items-center justify-center px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
              Orçamento Grátis
            </div>

            <div className="py-6 relative z-10 max-w-3xl w-full">
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight text-white/90 drop-shadow-lg text-center md:text-left">
                Pronto para <br /> Começar seu Projeto?
              </h3>
              <p className="text-lg md:text-xl text-white/90 mb-10 leading-relaxed max-w-2xl drop-shadow-md text-center md:text-left mx-auto md:mx-0">
                Solicite um orçamento gratuito e receba nossa proposta
                personalizada. Atendimento com segurança, qualidade e manutenção
                constante dos equipamentos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center md:items-start w-full">
                {telefone || whatsapp || isLoading ? (
                  <div className="w-full sm:w-auto inline-flex items-center justify-center px-8 h-14 bg-white text-orange-600 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-300 hover:scale-105 group gap-2 shadow-lg">
                    {telefone ? (
                      <a
                        href={`tel:+55${telefone.replace(/\D/g, '')}`}
                        className="hidden sm:inline"
                      >
                        {telefone}
                      </a>
                    ) : null}
                    {telefone && whatsapp ? (
                      <span className="hidden sm:inline text-orange-400">
                        |
                      </span>
                    ) : null}
                    {whatsapp ? (
                      <a
                        href={`tel:+55${whatsapp.replace(/\D/g, '')}`}
                        className=""
                      >
                        {whatsapp}
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <a
                  href="/orcamento"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 h-14 bg-yellow-500 text-gray-900 font-semibold rounded-xl hover:bg-yellow-400 transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  Solicitar Orçamento Online
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
