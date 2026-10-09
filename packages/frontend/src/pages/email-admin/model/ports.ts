export interface EmailPagePorts {
  query: { get(key: string): string | null }
  isMobile: boolean
  readHighlighted(): string[]
  persistHighlighted(keys: string[]): void
  download(
    blob: Blob,
    name: string,
    isCurrent: () => boolean
  ): Promise<void> | void
  focusSearch(id: string): void
  connect(): void | Promise<void>
}
export interface ComposerSelection {
  files: Array<{ name: string; size: number }>
  multipart: FormData
}
export interface ComposerPorts {
  uuid(): string
  afterUpload(): void
}
