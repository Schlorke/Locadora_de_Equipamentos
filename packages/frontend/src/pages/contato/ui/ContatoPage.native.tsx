import { ScrollView, View, Text } from 'react-native'
import { Card, Badge, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Headphones,
  Calendar,
  Award,
} from 'lucide-react-native'
import { ContactForm } from '../../../features/enviar-contato'
import { ContactInfoCard } from '../../../widgets/contato-empresa'
import { useContactPage } from '../model/use-contact-page'
const icons = { Phone, Mail, MapPin, Clock, Headphones, Calendar, Award }

/**
 * Contato do app: o mesmo modelo da web (`model/use-contact-page.ts`). Onda 134: horário e CNPJ da própria locadora
 * (pendência da onda 133) e números, serviços, selos e endereço do mapa só com o que ela declarou no painel.
 */
export function ContatoPage() {
  const model = useContactPage(),
    theme = useTheme()
  const horario = model.contactInfo.find((info) => info.icon === 'Clock')
  const titulo = {
    color: theme.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: space.md,
        gap: space.lg,
        backgroundColor: theme.background,
      }}
    >
      <View
        style={{
          padding: space.lg,
          gap: space.md,
          backgroundColor: theme.primary,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: theme.onPrimary,
            fontSize: typography.size.xl,
            fontWeight: typography.weight.semibold,
          }}
        >
          Entre em Contato
        </Text>
        <Text style={{ color: theme.onPrimary }}>
          Estamos prontos para atender você e tornar seu projeto realidade. Fale
          conosco e descubra as melhores soluções em locação de equipamentos.
        </Text>
        {model.stats.length > 0 ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          >
            {model.stats.map((stat) => (
              <Badge key={stat.label}>{`${stat.number} ${stat.label}`}</Badge>
            ))}
          </View>
        ) : null}
      </View>
      <Card>
        <View style={{ gap: space.md }}>
          <Text accessibilityRole="header" style={titulo}>
            Solicite um Orçamento
          </Text>
          <Text style={{ color: theme.textMuted }}>
            Preencha o formulário e receba nossa melhor proposta
          </Text>
          <ContactForm />
        </View>
      </Card>
      <ContactInfoCard />
      {horario || model.linhaDoCnpj ? (
        <Card>
          <View style={{ gap: space.sm }}>
            {horario ? (
              <>
                <Clock color={theme.primary} />
                <Text accessibilityRole="header" style={titulo}>
                  {horario.title}
                </Text>
                <Text style={{ color: theme.text }}>{horario.main}</Text>
                {horario.subtitle ? (
                  <Text style={{ color: theme.textMuted }}>
                    {horario.subtitle}
                  </Text>
                ) : null}
              </>
            ) : null}
            {model.linhaDoCnpj ? (
              <Text style={{ color: theme.textMuted }}>{model.linhaDoCnpj}</Text>
            ) : null}
          </View>
        </Card>
      ) : null}
      <Card>
        <View style={{ gap: space.lg }}>
          <Text accessibilityRole="header" style={titulo}>
            Nossos Diferenciais
          </Text>
          <Text style={{ color: theme.textMuted }}>
            O que nos torna únicos no mercado de locação
          </Text>
          {model.services.map((service) => {
            const Icon = icons[service.icon]
            return (
              <View key={service.title} style={{ gap: space.sm }}>
                <Icon color={theme.primary} />
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.semibold,
                  }}
                >
                  {service.title}
                </Text>
                <Text style={{ color: theme.textMuted }}>
                  {service.description}
                </Text>
              </View>
            )
          })}
        </View>
      </Card>
      {model.local ? (
        <Card>
          <View style={{ gap: space.md }}>
            <Text accessibilityRole="header" style={titulo}>
              Onde estamos
            </Text>
            <Text style={{ color: theme.textMuted }}>
              Endereço, horários e como chegar
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <MapPin color={theme.primary} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text style={{ color: theme.text }}>{model.local.address1}</Text>
                {model.local.address2 ? (
                  <Text style={{ color: theme.textMuted }}>
                    {model.local.address2}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </Card>
      ) : null}
      <Card>
        <View style={{ gap: space.md }}>
          <Award color={theme.primary} />
          <Text accessibilityRole="header" style={titulo}>
            Atendimento Especializado em Toda Região
          </Text>
          <Text style={{ color: theme.textMuted }}>
            Consulte a locadora sobre orientação técnica, entrega e área de
            atendimento.
          </Text>
          {model.selos.length > 0 ? (
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
            >
              {model.selos.map((selo) => (
                <Badge key={selo}>{selo}</Badge>
              ))}
            </View>
          ) : null}
        </View>
      </Card>
    </ScrollView>
  )
}
