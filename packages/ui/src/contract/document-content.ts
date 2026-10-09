import type { ComponentType } from 'react'
export type DocumentNode =
  | string
  | {
      tag: string
      props?: Record<string, string | number | boolean>
      children?: DocumentNode[]
    }
export type DocumentComponents = Record<
  string,
  ComponentType<Record<string, unknown>>
>
export interface DocumentContentProps {
  node: DocumentNode
  components?: DocumentComponents
}
