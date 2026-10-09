import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Image, Pressable, Text, TextInput, View } from 'react-native'
import { space } from '@gb-locacoes/design-tokens'
import { useTheme } from '../theme/ThemeProvider'
interface Props {
  images?: string[]
  maxImages?: number
  onImagesChange?: (images: string[]) => void
  sectionTitle?: string
  chooseImages?: (remaining: number) => Promise<string[]>
  renderImage?: (src: string, alt: string) => ReactNode
  disabled?: boolean
}
export function ImageUpload({
  images = [],
  maxImages = 5,
  onImagesChange,
  sectionTitle = 'Imagens',
  chooseImages,
  renderImage,
  disabled = false,
}: Props) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    theme = useTheme()
  const active = useRef(true),
    current = useRef(images)
  current.current = images
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const blocked = disabled || busy
  const add = () => {
    if (blocked) return
    if (!/^https?:\/\//.test(url)) {
      setError('Informe uma URL de imagem HTTP ou HTTPS')
      return
    }
    if (images.length >= maxImages) return
    onImagesChange?.([...images, url])
    setUrl('')
    setError('')
  }
  const move = (index: number) => {
    if (blocked || index === 0) return
    const next = [...images]
    ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
    onImagesChange?.(next)
  }
  const choose = async () => {
    if (blocked || !chooseImages) return
    setBusy(true)
    setError('')
    try {
      const urls = await chooseImages(maxImages - current.current.length)
      if (!active.current) return
      if (current.current.length + urls.length > maxImages)
        throw new Error('Limite de imagens excedido.')
      if (urls.length) onImagesChange?.([...current.current, ...urls])
    } catch (err) {
      if (
        active.current &&
        !(err instanceof Error && err.name === 'AbortError')
      )
        setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: theme.text }}>
        {sectionTitle} ({images.length}/{maxImages})
      </Text>
      {images.map((src, index) => (
        <View key={src + '-' + index} style={{ gap: space.xs }}>
          {renderImage?.(src, 'Imagem ' + (index + 1)) ?? (
            <Image
              source={{ uri: src }}
              accessibilityLabel={'Imagem ' + (index + 1)}
              style={{
                width: space.xxl + space.xxl,
                height: space.xxl + space.xxl,
              }}
            />
          )}
          <Text style={{ color: theme.textMuted }}>
            {index === 0 ? 'Imagem principal' : 'Imagem ' + (index + 1)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Remover imagem ' + (index + 1)}
            disabled={blocked}
            onPress={() =>
              onImagesChange?.(images.filter((_, i) => i !== index))
            }
          >
            <Text style={{ color: theme.text }}>Remover</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Mover imagem ' + (index + 1) + ' para antes'}
            disabled={blocked || index === 0}
            onPress={() => move(index)}
          >
            <Text style={{ color: theme.text }}>Mover para antes</Text>
          </Pressable>
        </View>
      ))}
      {chooseImages ? (
        <Pressable
          accessibilityRole="button"
          disabled={blocked || images.length >= maxImages}
          onPress={() => void choose()}
        >
          <Text style={{ color: theme.text }}>
            {busy ? 'Enviando imagens...' : 'Escolher arquivos'}
          </Text>
        </Pressable>
      ) : null}
      <TextInput
        accessibilityLabel={'URL — ' + sectionTitle}
        value={url}
        onChangeText={setUrl}
        placeholder="URL da imagem"
        editable={!blocked && images.length < maxImages}
        autoCapitalize="none"
      />
      <Pressable
        accessibilityRole="button"
        disabled={blocked || images.length >= maxImages}
        onPress={add}
      >
        <Text style={{ color: theme.text }}>Adicionar imagem por URL</Text>
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}
