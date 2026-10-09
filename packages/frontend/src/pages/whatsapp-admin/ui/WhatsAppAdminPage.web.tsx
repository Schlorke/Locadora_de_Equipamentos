'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'

import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { WhatsAppLayoutContainer } from './Layout.web'
import { WhatsAppFullViewDialog } from './DialogoCompleto.web'
import { WhatsAppComposerDialog } from './DialogoCompositor.web'
import { MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'

import { useWhatsAppPage } from '../model/use-whatsapp-page'
export function AdminWhatsAppPage() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.tenant.status,
    tenant?.role,
    slug,
    session?.user?.id,
    revision,
  ])
  return <AdminWhatsAppPageContent key={scope} />
}
function AdminWhatsAppPageContent() {
  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    conversationsLoading,
    messages,
    messagesLoading,
    loadMoreMessagesLoading,
    hasMoreMessages,
    isFullViewOpen,
    composerOpen,
    setComposerOpen,
    sending,
    currentConversation,
    fetchConversations,
    handleLoadMoreMessages,
    handleReply,
    handleSendReply,
    handleExpand,
    handleCloseFullView,
    conversationLabel,
  } = useWhatsAppPage()
  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title="WhatsApp"
        subtitle="Acompanhe e responda mensagens de clientes"
        icon={<MessageCircle className="h-6 w-6" />}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="h-[calc(100vh-250px)] min-h-[600px]"
      >
        <WhatsAppLayoutContainer
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          conversationsLoading={conversationsLoading}
          messages={messages}
          messagesLoading={messagesLoading}
          currentConversation={currentConversation}
          onReply={handleReply}
          onExpand={handleExpand}
          onLoadMoreMessages={handleLoadMoreMessages}
          loadMoreMessagesLoading={loadMoreMessagesLoading}
          hasMoreMessages={hasMoreMessages}
          onRefresh={fetchConversations}
          refreshLoading={conversationsLoading}
        />
      </motion.div>

      <WhatsAppFullViewDialog
        isOpen={isFullViewOpen}
        onClose={handleCloseFullView}
        conversation={currentConversation}
        messages={messages}
        onReply={handleReply}
      />

      <WhatsAppComposerDialog
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        conversationLabel={conversationLabel}
        onSend={handleSendReply}
        sending={sending}
      />
    </div>
  )
}
