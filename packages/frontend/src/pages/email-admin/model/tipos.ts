export interface EmailFolder {
  folderId: string
  folderName: string
  unreadCount?: number
  totalCount?: number
}

export interface EmailMessage {
  messageId: string
  threadId?: string
  subject?: string
  summary?: string
  fromAddress?: {
    emailAddress?: string
    displayName?: string
  }
  receivedTime?: number
  sentTime?: number
  isRead?: boolean
  isStarred?: boolean
  hasAttachments?: boolean
}

export interface EmailViewerMessage {
  messageId: string
  subject?: string
  fromAddress?: {
    emailAddress?: string
    displayName?: string
  }
  toAddress?: Array<{
    emailAddress?: string
    displayName?: string
  }>
  receivedTime?: number
  sentTime?: number
  content?: string
  htmlContent?: string
  attachments?: Array<{
    attachmentId: string
    fileName: string
    size?: number
  }>
  isRead?: boolean
  isStarred?: boolean
}

export type ComposerMode = 'new' | 'reply' | 'forward'

export type ComposerAttachment = {
  storeName: string
  attachmentName: string
  attachmentPath: string
  fileName: string
  size?: number
}

export interface EmailComposerDialogProps {
  isOpen: boolean
  onClose: () => void
  mode: ComposerMode
  fromAddress: string
  /** Para reply: messageId da mensagem original */
  messageId?: string
  /** Para drafts: messageId do rascunho atual */
  draftMessageId?: string
  /** Para drafts: folderId da pasta de rascunhos */
  draftFolderId?: string | null
  initialTo?: string
  initialSubject?: string
  initialContent?: string
  onSent?: () => void
  onDraftSaved?: (_draftId: string | null) => void
}

export type Account = {
  accountId?: string
  primaryEmailAddress?: string
  accountName?: string
}
