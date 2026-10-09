import { useEffect, useState, type ReactNode } from 'react'
import { View, Text } from 'react-native'
import { Button, Card, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import type { SectionKey } from '../model/use-settings-data'
import type { SettingsInput } from '../model/settings.schema'
import { siglaDaLocadora } from '../../../entities/organizacao'
interface Props {
  section: SectionKey
  data: SettingsInput
  /** Nome da locadora selecionada; nunca o de outra (achado 143). */
  name?: string
  image(props: { src: string; alt: string; height: number }): ReactNode
}
export function SettingsPreviews({ section, data, name, image }: Props) {
  const nome = name?.trim() || 'Sua locadora'
  const theme = useTheme(),
    [index, setIndex] = useState(0),
    images = (data.heroCarousel ?? []).map((item) =>
      typeof item === 'string' ? item : item.imageUrl
    )
  useEffect(() => {
    setIndex(0)
  }, [images.length, section])
  useEffect(() => {
    if (section !== 'hero' || images.length <= 1) return
    const timer = setInterval(
      () => setIndex((value) => (value + 1) % images.length),
      3000
    )
    return () => clearInterval(timer)
  }, [section, images.length])
  const text = (value: ReactNode) => (
    <Text style={{ color: theme.text }}>{value}</Text>
  )
  const heading = (value: string) => (
    <Text
      accessibilityRole="header"
      style={{ color: theme.text, fontWeight: typography.weight.semibold }}
    >
      {value}
    </Text>
  )
  return (
    <Card>
      <View style={{ gap: space.sm }}>
        {section === 'company' ? (
          <>
            {heading('Preview Header & Footer')}
            {data.companyIconUrl
              ? image({
                  src: data.companyIconUrl,
                  alt: 'Logo no preview',
                  height: space.xxl * 2,
                })
              : text(siglaDaLocadora(nome))}
            {text(nome)}
            {text(data.companyPhone + ' | ' + data.whatsappNumber)}
            {text(data.contactEmail)}
            {text(data.marketingEmail)}
            {text(data.companyAddress)}
            {text(data.aboutUsText)}
            {heading('Como aparece no Google')}
            {text(nome + ' - Locação de Equipamentos para Construção')}
            {text(
              data.aboutUsText || 'Sua descrição personalizada aparecerá aqui.'
            )}
          </>
        ) : null}
        {section === 'hero' ? (
          <>
            {heading('Preview Hero Carousel')}
            {images[index] ? (
              image({
                src: images[index]!,
                alt: 'Imagem do carousel ' + (index + 1),
                height: space.xxl * 6,
              })
            ) : (
              <View
                style={{ backgroundColor: theme.primary, padding: space.lg }}
              >
                {text('Equipamentos para Construção')}
              </View>
            )}
            {text('Preview em Tempo Real')}
            {text('Animação da onda: ' + data.waveAnimation)}
            <Button variant="outline" onClick={() => setIndex(0)}>
              Reiniciar preview
            </Button>
          </>
        ) : null}
        {section === 'social' ? (
          <>
            {heading('Preview Redes Sociais')}
            {text('Nenhuma rede social configurada')}
          </>
        ) : null}
        {section === 'seo' ? (
          <>
            {heading('Preview SEO')}
            {data.favicon
              ? image({
                  src: data.favicon,
                  alt: 'Favicon no preview',
                  height: space.xxl,
                })
              : null}
            {text(data.seoTitle || 'Título SEO da página')}
            {text(
              data.seoDescription ||
                'Sua descrição personalizada aparecerá aqui.'
            )}
          </>
        ) : null}
        {section === 'system' ? (
          <>
            {heading('Preview Sistema')}
            {text(
              'Modo Manutenção: ' +
                (data.maintenanceMode ? 'Ativado' : 'Desativado')
            )}
            {text('Moeda: ' + data.baseCurrency)}
            {text('Fuso horário: America/Sao_Paulo')}
            {text('Cadastro permitido: Sim')}
            {text('Verificação de e-mail: Sim')}
            {text('Máximo de itens por orçamento: 50')}
          </>
        ) : null}
        {section === 'custom' ? (
          <>
            {heading('Preview Configurações Avançadas')}
            {text(
              'Google Analytics: ' +
                (data.analyticsTrackingId || 'Não configurado')
            )}
            {text(
              data.customCss
                ? data.customCss.substring(0, 100) +
                    (data.customCss.length > 100 ? '...' : '')
                : 'Nenhum CSS customizado'
            )}
            {text(
              data.customJs
                ? data.customJs.substring(0, 100) +
                    (data.customJs.length > 100 ? '...' : '')
                : 'Nenhum JavaScript customizado'
            )}
          </>
        ) : null}
      </View>
    </Card>
  )
}
