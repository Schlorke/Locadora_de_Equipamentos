import type { ReactNode } from 'react'
import type { ComposerSelection } from './ports'
export interface NativeMailPorts {
  readHighlighted(key: string): Promise<string[]>
  persistHighlighted(key: string, keys: string[]): void
  download(blob: Blob, name: string, isCurrent: () => boolean): Promise<void>
  connect(): Promise<void>
  pickFiles(): Promise<ComposerSelection | null>
  uuid(): string
  html(html: string, height: number): ReactNode
}
