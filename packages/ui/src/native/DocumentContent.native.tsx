import { createElement } from 'react'
import { View, Text, Linking } from 'react-native'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useTheme } from '../theme/ThemeProvider'
import type {
  DocumentContentProps,
  DocumentNode,
} from '../contract/document-content'
const inlineTags = new Set([
  'span',
  'strong',
  'b',
  'em',
  'i',
  'a',
  'br',
  'small',
])
const textTags = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  ...inlineTags,
])
function isInline(node: DocumentNode): boolean {
  return typeof node === 'string' || inlineTags.has(node.tag)
}
export function DocumentContent({
  node,
  components = {},
}: DocumentContentProps) {
  const theme = useTheme()
  if (typeof node === 'string')
    return <Text style={{ color: theme.text }}>{node}</Text>
  const children = (node.children ?? []).map((child, index) => (
    <DocumentContent key={index} node={child} components={components} />
  ))
  const Slot = components[node.tag]
  if (Slot)
    return createElement(
      Slot,
      node.props,
      children.length ? children : undefined
    )
  if (/^[A-Z]/.test(node.tag))
    throw new Error('Componente de documento ausente: ' + node.tag)
  if (node.tag === 'br') return <Text>{'\n'}</Text>
  if (textTags.has(node.tag)) {
    const heading = /^h[1-6]$/.test(node.tag),
      bold = heading || node.tag === 'strong' || node.tag === 'b',
      href = node.props?.href
    const open =
      typeof href === 'string' && /^(https?:|mailto:|tel:)/.test(href)
        ? () => void Linking.openURL(href)
        : undefined
    return (
      <Text
        accessibilityRole={heading ? 'header' : open ? 'link' : undefined}
        onPress={open}
        style={{
          color: open ? theme.primary : theme.text,
          fontSize: heading ? typography.size.lg : typography.size.md,
          fontWeight: bold ? typography.weight.semibold : typography.weight.regular,
          fontStyle:
            node.tag === 'em' || node.tag === 'i' ? 'italic' : 'normal',
          lineHeight: typography.size.md * typography.lineHeightRatio.body,
        }}
      >
        {children}
      </Text>
    )
  }
  if (node.tag === 'li')
    return (
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Text style={{ color: theme.text }}>•</Text>
        <View style={{ flex: 1, gap: space.sm }}>
          {(node.children ?? []).every(isInline) ? (
            <Text
              style={{
                color: theme.text,
                lineHeight: typography.size.md * typography.lineHeightRatio.body,
              }}
            >
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      </View>
    )
  if (!['div', 'section', 'article', 'ul', 'ol'].includes(node.tag))
    throw new Error('Elemento de documento não suportado: ' + node.tag)
  return <View style={{ gap: space.md }}>{children}</View>
}
