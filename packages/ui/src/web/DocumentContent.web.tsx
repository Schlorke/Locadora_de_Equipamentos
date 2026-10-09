import { createElement, type ReactNode } from 'react'
import type { DocumentContentProps } from '../contract/document-content'
export function DocumentContent({
  node,
  components = {},
}: DocumentContentProps): ReactNode {
  if (typeof node === 'string') return node
  const element = components[node.tag] ?? node.tag
  if (/^[A-Z]/.test(node.tag) && !components[node.tag])
    throw new Error('Componente de documento ausente: ' + node.tag)
  return createElement(
    element,
    node.props,
    ...(node.children ?? []).map((child, index) =>
      createElement(DocumentContent, { node: child, components, key: index })
    )
  )
}
