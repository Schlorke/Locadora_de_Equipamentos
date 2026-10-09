import { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  Link,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import type { EquipmentDetailProps } from '../model/detail-contract'
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
import type { EquipmentDetailScreenProps } from '../model/detail-contract'
import { SmartEquipmentPricing } from './EquipamentoPreco.native'

export { buildSharePayload } from '../model/detail-contract'

export function EquipmentInclusionItem({
  text,
}: {
  iconColor?: 'green' | 'blue' | 'orange'
  text: string
}) {
  const theme = useTheme()
  return <Text style={{ color: theme.text }}>✓ {text}</Text>
}

export function EquipamentoDetalhePage(
  props: EquipmentDetailProps &
    Pick<EquipmentDetailScreenProps, 'image' | 'onShare'>
) {
  const theme = useTheme()
  const [imageIndex, setImageIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  // Nome e cidade da própria locadora (cartão público), nunca os da GB (achado 143).
  const identidade = useIdentidadePublica()
  const locadora = identidade?.nome ?? null
  const cidade = identidade?.cidade ?? null
  // Onda 134: as mesmas promessas da web (`entities/configuracao`), só com os compromissos declarados (D-E), e a
  // nota só com a fonte (D-A).
  const { settings } = usePublicSettings()
  const declarados = compromissosDeclarados(settings.siteContent)
  const topo = comCompromissosDeclarados(declarados, DETALHE_TOPO)
  const incluido = comCompromissosDeclarados(declarados, DETALHE_INCLUIDO)
  const porQue = comCompromissosDeclarados(
    declarados,
    detalhePorQueEscolher(cidade)
  )
  const anos = anosNoMercado(settings.siteContent?.experienceYears)
  const nota = notaDaLocadora(settings.siteContent)
  const images = props.images.length
    ? props.images
    : ['/placeholder.svg?height=600&width=800&text=Equipamento']
  const current = images[imageIndex] ?? images[0]!
  const renderImage = (height: number) =>
    props.images.length ? (
      props.image({ src: current, alt: props.name, height })
    ) : (
      <View
        style={{
          minHeight: height,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: theme.textMuted }}>Equipamento</Text>
      </View>
    )
  const share = async () => {
    if (!props.onShare || sharing) return
    setSharing(true)
    setShareError(null)
    try {
      await props.onShare(props.name)
    } catch {
      setShareError('Não foi possível compartilhar o equipamento.')
    } finally {
      setSharing(false)
    }
  }
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg }}>
      <Link href="/equipamentos">Voltar para equipamentos</Link>
      <Text style={{ color: theme.textMuted }}>
        Equipamentos / {props.categoryName} / {props.name}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        {props.name}
      </Text>
      {topo.length > 0 ? (
        <Text style={{ color: theme.textMuted }}>
          {topo.map((frase) => frase.texto).join(' · ')}
        </Text>
      ) : null}
      {nota ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Text style={{ color: theme.textMuted }}>
            {`${nota.nota} de 5 (${nota.quantidade} no`}
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={nota.fonte}
            onPress={() => void Linking.openURL(nota.url)}
          >
            <Text style={{ color: theme.primary }}>{` ${nota.fonte}`}</Text>
          </Pressable>
          <Text style={{ color: theme.textMuted }}>)</Text>
        </View>
      ) : null}
      <Card>
        <CardContent>
          {renderImage(280)}
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          >
            <Button
              variant="outline"
              disabled={images.length < 2}
              onClick={() =>
                setImageIndex((n) => (n - 1 + images.length) % images.length)
              }
            >
              Imagem anterior
            </Button>
            <Button
              variant="outline"
              disabled={images.length < 2}
              onClick={() => setImageIndex((n) => (n + 1) % images.length)}
            >
              Próxima imagem
            </Button>
            <Button variant="outline" onClick={() => setZoom(true)}>
              Ampliar imagem
            </Button>
          </View>
          <Text style={{ color: theme.textMuted }}>
            Imagem {imageIndex + 1} de {images.length}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
          >
            {images.map((src, i) => (
              <Button
                key={`${src}-${i}`}
                size="sm"
                variant={imageIndex === i ? 'default' : 'outline'}
                onClick={() => setImageIndex(i)}
              >
                Imagem {i + 1}
              </Button>
            ))}
          </View>
        </CardContent>
      </Card>
      <Dialog.Root open={zoom} onOpenChange={setZoom}>
        <Dialog.Popup>
          <Dialog.Title>{props.name}</Dialog.Title>
          <ScrollView maximumZoomScale={3} minimumZoomScale={1} centerContent>
            {renderImage(480)}
          </ScrollView>
          <Dialog.Close
            render={<Button variant="outline">Fechar imagem</Button>}
          />
        </Dialog.Popup>
      </Dialog.Root>
      <Badge>{props.available ? 'Disponível' : 'Indisponível'}</Badge>
      {props.onShare ? (
        <Button
          variant="outline"
          disabled={sharing}
          onClick={() => void share()}
        >
          {sharing ? 'Compartilhando...' : 'Compartilhar'}
        </Button>
      ) : null}
      {shareError ? (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {shareError}
        </Text>
      ) : null}
      <Card>
        <CardContent>
          <SmartEquipmentPricing
            {...props}
            equipmentName={props.name}
            isAvailable={props.available}
            description={props.description ?? undefined}
            category={{ name: props.categoryName }}
          />
        </CardContent>
      </Card>
      {props.description ? (
        <Card>
          <CardHeader>
            <CardTitle>Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <Text style={{ color: theme.text }}>{props.description}</Text>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <Text style={{ color: theme.text }}>
            Categoria: {props.categoryName}
          </Text>
          <Text style={{ color: theme.text }}>
            Preço diário: R$ {props.pricePerDay.toFixed(2)}
          </Text>
          <Text style={{ color: theme.text }}>
            Status: {props.available ? 'Disponível' : 'Indisponível'}
          </Text>
          {incluido.length > 0 ? (
            <>
              <Text style={{ color: theme.text }}>Incluído na locação:</Text>
              {incluido.map((item) => (
                <EquipmentInclusionItem key={item.chave} text={item.texto} />
              ))}
            </>
          ) : null}
        </CardContent>
      </Card>
      {porQue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Por que escolher {locadora ? `a ${locadora}` : 'a nossa locadora'}
              ?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {anos ? (
              <Text style={{ color: theme.textMuted }}>{anos}</Text>
            ) : null}
            {porQue.map((cartao) => (
              <View key={cartao.chave}>
                <Text style={{ color: theme.text }}>{cartao.titulo}</Text>
                <Text style={{ color: theme.textMuted }}>
                  {cartao.descricao}
                </Text>
              </View>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </ScrollView>
  )
}
