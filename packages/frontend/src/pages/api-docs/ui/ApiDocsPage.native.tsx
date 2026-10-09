import { ScrollView, View, Text, ActivityIndicator } from 'react-native'
import { Badge, Button, Card, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useApiDocs } from '../model/use-api-docs'
import { useDeviceActions } from '../../../shared/device'
import { toast } from '../../../shared/lib/toast'
export function ApiDocsPage() {
  const { spec, loading } = useApiDocs(),
    device = useDeviceActions(),
    theme = useTheme()
  if (loading)
    return (
      <View style={{ padding: space.lg }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.text }}>
          Carregando documentação da API...
        </Text>
      </View>
    )
  if (!spec)
    return (
      <Text
        accessibilityRole="alert"
        style={{ color: theme.danger, padding: space.lg }}
      >
        Erro ao carregar a documentação da API
      </Text>
    )
  const copy = async (path: string) => {
    try {
      await device.copyText((spec.servers?.[0]?.url ?? '') + path)
      toast.success('URL copiada')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível copiar a URL'
      )
    }
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.lg,
        backgroundColor: theme.background,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.semibold,
        }}
      >
        {spec.info.title}
      </Text>
      <Badge variant="outline">Versão {spec.info.version}</Badge>
      <Text style={{ color: theme.textMuted }}>{spec.info.description}</Text>
      {spec.servers?.length ? (
        <Card>
          <View style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
              style={{ color: theme.text, fontSize: typography.size.lg }}
            >
              Servidores
            </Text>
            {spec.servers.map((server) => (
              <Text key={server.url} selectable style={{ color: theme.text }}>
                {server.url} - {server.description}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
      <Text
        accessibilityRole="header"
        style={{ color: theme.text, fontSize: typography.size.lg }}
      >
        Endpoints
      </Text>
      {Object.entries(spec.paths).map(([path, methods]) => (
        <Card key={path}>
          <View style={{ gap: space.md }}>
            <Text
              accessibilityRole="header"
              selectable
              style={{ color: theme.text, fontWeight: typography.weight.semibold }}
            >
              {path}
            </Text>
            {Object.entries(methods).map(([method, details]) => (
              <View key={method} style={{ gap: space.sm }}>
                <Badge>{method.toUpperCase()}</Badge>
                <Text style={{ color: theme.text }}>
                  {details.summary ?? 'Sem descrição'}
                </Text>
                {details.description ? (
                  <Text style={{ color: theme.textMuted }}>
                    {details.description}
                  </Text>
                ) : null}
                {details.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
                <Button variant="outline" onClick={() => void copy(path)}>
                  Copiar URL
                </Button>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </ScrollView>
  )
}
