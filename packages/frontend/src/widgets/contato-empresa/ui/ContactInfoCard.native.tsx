import { View, Text, Linking, ActivityIndicator } from 'react-native'
import { Mail, MapPin, Phone } from 'lucide-react-native'
import { Card, Button, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useContactInfo } from '../model/use-contact-info'
import type { ContactInfoCardProps } from './contract'
export function ContactInfoCard(props: ContactInfoCardProps) {
  const info = useContactInfo(props),
    theme = useTheme()
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <View
          style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}
        >
          <Mail color={theme.primary} />
          <Text
            accessibilityRole="header"
            style={{
              color: theme.text,
              fontSize: typography.size.lg,
              fontWeight: typography.weight.semibold,
            }}
          >
            Entre em Contato
          </Text>
        </View>
        <Text style={{ color: theme.textMuted }}>
          Respondemos com agilidade e transparência.
        </Text>
        <Text style={{ color: theme.text }}>
          {props.description ??
            'Nossa equipe está pronta para esclarecer suas dúvidas.'}
        </Text>
        {info.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
        {!info.hasContact && !info.isLoading ? (
          <Text accessibilityRole="alert" style={{ color: theme.textMuted }}>
            {info.error ?? 'Informações de contato ainda não configuradas.'}
          </Text>
        ) : null}
        {info.emailHref ? (
          <Button
            variant="outline"
            onClick={() => void Linking.openURL(info.emailHref!)}
          >
            E-mail: {info.email}
          </Button>
        ) : null}
        {info.secondaryEmail ? (
          <Text style={{ color: theme.textMuted }}>
            {info.secondaryEmail} · automações e campanhas
          </Text>
        ) : null}
        {info.phoneHref ? (
          <Button
            variant="outline"
            onClick={() => void Linking.openURL(info.phoneHref!)}
          >
            <Phone color={theme.primary} />
            <Text style={{ color: theme.text }}>Telefone: {info.phone}</Text>
          </Button>
        ) : null}
        {info.whatsappHref ? (
          <Button
            variant="outline"
            onClick={() => void Linking.openURL(info.whatsappHref!)}
          >
            WhatsApp: {info.whatsapp}
          </Button>
        ) : null}
        {info.address ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <MapPin color={theme.primary} />
            <Text style={{ color: theme.text, flex: 1 }}>
              Endereço: {info.address}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  )
}
