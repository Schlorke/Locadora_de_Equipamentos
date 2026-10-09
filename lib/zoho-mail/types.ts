/**
 * Tipos para integração Zoho Mail API
 */

export interface ZohoMailAccount {
  accountId: string
  accountName: string
  primaryEmailAddress: string
  isPrimary?: boolean
}

export interface ZohoMailFolder {
  folderId: string
  folderName: string
  unreadCount?: number
  totalCount?: number
  type?: string
  parentFolderId?: string
}

export interface ZohoMailAddress {
  emailAddress: string
  displayName?: string
}

export interface ZohoMailMessageSummary {
  messageId: string
  threadId?: string
  subject: string
  fromAddress: ZohoMailAddress
  toAddress?: ZohoMailAddress[]
  sentTime?: number
  receivedTime?: number
  isRead?: boolean
  isStarred?: boolean
  hasAttachments?: boolean
  summary?: string
}

export interface ZohoMailMessage extends ZohoMailMessageSummary {
  content?: string
  htmlContent?: string
  attachments?: ZohoMailAttachment[]
  ccAddress?: ZohoMailAddress[]
  bccAddress?: ZohoMailAddress[]
}

export interface ZohoMailAttachment {
  attachmentId: string
  fileName: string
  size?: number
  contentType?: string
}

export interface ZohoMailUploadedAttachment {
  storeName: string
  attachmentName: string
  attachmentPath: string
  fileName: string
  size?: number
}

export interface ZohoMailApiError {
  code: string
  description: string
  moreInfo?: string
}
