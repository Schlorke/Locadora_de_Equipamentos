import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button, Dialog, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import type { EquipmentImagePort } from '../model/tipos'
export function EquipmentGallery({
  images,
  name,
  image,
}: EquipmentImagePort & { images: string[]; name: string }) {
  const [index, setIndex] = useState(0),
    [zoom, setZoom] = useState(false),
    theme = useTheme()
  const current = images[index] ?? images[0]
  if (!current)
    return <Text style={{ color: theme.textMuted }}>Sem imagens</Text>
  const picture = (height: number) =>
    image?.({
      src: current,
      alt: name + ' — imagem ' + (index + 1),
      height,
    }) ?? <Text style={{ color: theme.text }}>{name}</Text>
  return (
    <View style={{ gap: space.sm }}>
      {picture(240)}
      <Text style={{ color: theme.textMuted }}>
        Imagem {index + 1} de {images.length}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button
          variant="outline"
          disabled={images.length < 2}
          onClick={() => setIndex((index + images.length - 1) % images.length)}
        >
          Imagem Anterior
        </Button>
        <Button
          variant="outline"
          disabled={images.length < 2}
          onClick={() => setIndex((index + 1) % images.length)}
        >
          Próxima Imagem
        </Button>
        <Button variant="outline" onClick={() => setZoom(true)}>
          Ampliar Imagem
        </Button>
      </View>
      <Dialog.Root open={zoom} onOpenChange={setZoom}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{name}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>{picture(400)}</Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setZoom(false)}>
                  Fechar Imagem
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </View>
  )
}
