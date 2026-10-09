export interface WhatsAppConversationItem {
  id: string
  phone: string
  displayName: string | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  messageCount?: number
}

export interface WhatsAppMessageItem {
  id: string
  conversationId: string
  providerMessageId: string | null
  direction: 'INBOUND' | 'OUTBOUND'
  type: string
  body: string
  mediaUrl?: string | null
  timestamp: string
  status?: string | null
  createdAt: string
}
