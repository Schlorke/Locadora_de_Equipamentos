'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'

import { Suspense } from 'react'
import { AdminFilterCard } from '../../../widgets/filtro-admin'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { DateRangePicker } from '../../../widgets/seletor-data'
import { EmailLayoutContainer } from './email-layout-container.web'
import { EmailFullViewDialog } from './email-full-view-dialog.web'
import { EmailComposerDialog } from './email-composer-dialog.web'
import { Dialog } from '@gb-locacoes/ui'
import { Link2, Loader2, Mail, ShieldAlert, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEmailPage } from '../model/carga.web'
import { getSenderKey } from '../../../features/correio'

function AdminEmailContent() {
  const email = useEmailPage()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-[1800px] mx-auto">
        <AdminPageHeader
          title="E-mail"
          subtitle="Gerencie a caixa Zoho Mail pelo painel"
          icon={<Mail className="w-8 h-8" />}
          infoBadge={
            email.connected
              ? {
                  icon: <Mail className="w-5 h-5 text-orange-50" />,
                  text: `Conectado: ${email.accountLabel}`,
                }
              : {
                  icon: <Mail className="w-5 h-5 text-orange-50" />,
                  text: 'Não conectado',
                }
          }
          className="mb-8"
        />

        {email.connected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <AdminFilterCard
              searchPlaceholder="Buscar por remetente, assunto..."
              searchValue={email.searchQuery}
              onSearchChange={email.setSearchQuery}
              searchInputId={email.searchInputId}
              filters={[
                {
                  label: 'Exibir',
                  value: email.quickFilter,
                  onValueChange: (v) =>
                    email.setQuickFilter(
                      v as 'all' | 'unread' | 'starred' | 'attachments'
                    ),
                  placeholder: 'Exibir',
                  options: [
                    { value: 'all', label: 'Todas' },
                    { value: 'unread', label: 'Não lidas' },
                    { value: 'starred', label: 'Destacadas' },
                    { value: 'attachments', label: 'Com anexos' },
                  ],
                },
              ]}
              extraFilters={
                <DateRangePicker
                  startDate={email.dateStart}
                  endDate={email.dateEnd}
                  onDateChange={email.handleDateRangeChange}
                  placeholder="Filtrar por período"
                  allowPastDates
                  showGuidedToasts
                />
              }
              onReset={email.handleResetFilters}
              actionButtons={
                <Button
                  variant="default"
                  size="sm"
                  onClick={email.openComposerNew}
                  className="shrink-0"
                  aria-label="Novo e-mail"
                >
                  Novo e-mail
                </Button>
              }
            />
          </motion.div>
        )}

        {email.loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        )}

        {!email.loading && email.error && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-6">
              <p className="text-amber-800">{email.error}</p>
            </CardContent>
          </Card>
        )}

        {!email.loading && !email.connected && !email.error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="relative overflow-visible border-0 shadow-xl bg-white backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white">
                    <Link2 className="h-5 w-5" />
                  </div>
                  Conectar Zoho Mail
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">
                  Conecte a conta Zoho Mail (ex.: contato@sualocadora.com.br)
                  para ver e gerenciar os e-mails diretamente aqui.
                </p>
                <Button onClick={email.handleConnect} variant="default">
                  Conectar Zoho Mail
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!email.loading && email.connected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="h-[calc(100vh-250px)] min-h-[600px]"
          >
            <EmailLayoutContainer
              folders={email.folders}
              selectedFolderId={email.selectedFolderId}
              onSelectFolder={email.setSelectedFolderId}
              foldersLoading={email.foldersLoading}
              messages={email.filteredMessages}
              selectedMessageId={email.selectedMessageId}
              onSelectMessage={email.handleSelectMessage}
              messagesLoading={email.messagesLoading}
              currentMessage={email.currentMessage}
              messageLoading={email.messageLoading}
              highlightedSenderKeys={email.highlightedSenderKeys}
              isSenderHighlightedForPreview={
                email.currentMessage != null &&
                email.highlightedSenderKeys.has(
                  getSenderKey(email.currentMessage)
                )
              }
              onReply={email.openComposerReply}
              onForward={email.openComposerForward}
              onExpand={email.handleExpandMessage}
              onMarkRead={email.handleMarkRead}
              onStar={email.handleStar}
              onUnstar={email.handleUnstar}
              onToggleStar={email.handleToggleStar}
              onQuickArchive={email.handleArchiveMessage}
              onQuickUnarchive={email.handleUnarchiveMessage}
              isArchiveFolder={email.isArchiveFolder}
              isSpamFolder={email.isSpamFolder}
              onMarkSpam={email.handleMarkSpam}
              onMarkNotSpam={email.handleMarkNotSpam}
              onQuickDelete={email.handleDeleteMessage}
              onQuickToggleRead={email.handleQuickToggleRead}
              onLoadMore={email.handleLoadMore}
              loadMoreLoading={email.messagesLoadMoreLoading}
              hasMoreMessages={email.hasMoreMessages}
              onDownloadAttachment={email.handleDownloadAttachment}
              isDraftFolder={email.isDraftFolder}
              onSendDraft={email.handleSendDraft}
              selectionMode={email.selectionMode}
              onSelectionModeChange={email.setSelectionMode}
              selectedIds={email.selectedIds}
              onToggleSelect={email.handleToggleSelect}
              onSelectAll={email.handleSelectAll}
              onClearSelection={email.handleClearSelection}
              onBulkArchive={email.handleBulkArchive}
              onBulkDelete={email.handleBulkDelete}
              bulkDeleteLoading={email.isBulkDeleting}
              onBulkMarkRead={email.handleBulkMarkRead}
              onBulkSpam={email.handleBulkSpam}
              onBulkNotSpam={email.handleBulkNotSpam}
              moveOptions={email.moveFolderOptions}
              onBulkMove={email.handleBulkMove}
              onDisconnect={email.handleDisconnect}
              onClearMessage={email.handleClearMessage}
              isMobile={email.isMobile}
              onRefresh={email.handleRefreshMessages}
            />
          </motion.div>
        )}

        {/* Dialog de visualização completa */}
        <EmailFullViewDialog
          message={email.fullViewMessage}
          isOpen={email.isFullViewOpen}
          onClose={email.handleCloseFullView}
          onReply={email.openComposerReply}
          onForward={email.openComposerForward}
          onDownloadAttachment={email.handleDownloadAttachment}
          isDraftFolder={email.isDraftFolder}
          onSendDraft={email.handleSendDraft}
          nestedDialogOpen={
            email.isFullViewOpen &&
            (email.composerOpen || email.showSpamConfirm)
          }
          isSenderHighlighted={
            !!email.fullViewMessage &&
            email.highlightedSenderKeys.has(getSenderKey(email.fullViewMessage))
          }
          onMarkRead={email.handleMarkRead}
          onMarkUnread={
            email.fullViewMessage
              ? () =>
                  email.handleQuickToggleRead(
                    email.fullViewMessage!.messageId,
                    true
                  )
              : undefined
          }
          onStar={email.handleStar}
          onUnstar={email.handleUnstar}
          onArchive={
            email.fullViewMessage
              ? () =>
                  email.handleArchiveMessage(email.fullViewMessage!.messageId)
              : undefined
          }
          onDelete={
            email.fullViewMessage
              ? () =>
                  email.handleDeleteMessage(email.fullViewMessage!.messageId)
              : undefined
          }
          onMarkSpam={email.handleMarkSpam}
          onMarkNotSpam={email.handleMarkNotSpam}
          isSpamFolder={email.isSpamFolder}
          isArchiveFolder={email.isArchiveFolder}
        />
        <EmailComposerDialog
          isOpen={email.composerOpen}
          onClose={() => email.setComposerOpen(false)}
          mode={email.composerMode}
          fromAddress={email.primaryEmail}
          messageId={email.composerMessageId ?? undefined}
          draftMessageId={email.composerDraftId ?? undefined}
          draftFolderId={email.draftFolderId}
          initialTo={email.composerInitialTo}
          initialSubject={email.composerInitialSubject}
          initialContent={email.composerInitialContent}
          onSent={email.handleComposerSent}
          onDraftSaved={email.handleDraftSaved}
        />

        {/* Dialog de confirmação para excluir permanentemente da lixeira */}
        <Dialog.Root
          open={email.showDeleteFromTrashConfirm}
          onOpenChange={(open) => {
            if (!open) {
              email.setShowDeleteFromTrashConfirm(false)
              email.setPendingDeleteFromTrashIds([])
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup
              variant="default"
              className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
            >
              <Dialog.Content>
                <Dialog.Header className="flex flex-row flex-wrap items-center gap-3 pb-3">
                  <Dialog.HeaderIcon>
                    <Trash2 className="h-4 w-4" />
                  </Dialog.HeaderIcon>
                  <Dialog.Title className="text-lg font-semibold text-gray-900 flex-1 min-w-0 pr-8">
                    Excluir permanentemente da lixeira?
                  </Dialog.Title>
                  <Dialog.CloseButton aria-label="Fechar" />
                </Dialog.Header>
                <Dialog.Body className="flex-none">
                  <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                    <Dialog.BodyContent className="space-y-2 py-2">
                      <p className="text-sm text-gray-600">
                        Esta ação não pode ser desfeita.{' '}
                        {email.pendingDeleteFromTrashIds.length === 1
                          ? 'A mensagem será'
                          : `${email.pendingDeleteFromTrashIds.length} mensagens serão`}{' '}
                        excluída(s) permanentemente e não poderá ser
                        recuperada(s).
                      </p>
                    </Dialog.BodyContent>
                  </Dialog.BodyViewport>
                </Dialog.Body>
                <Dialog.Footer className="flex flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      email.setShowDeleteFromTrashConfirm(false)
                      email.setPendingDeleteFromTrashIds([])
                    }}
                    disabled={email.isDeletingFromTrash}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="default"
                    onClick={email.handleConfirmDeleteFromTrash}
                    disabled={email.isDeletingFromTrash}
                    className="flex-1"
                  >
                    {email.isDeletingFromTrash ? 'Excluindo...' : 'Excluir'}
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Dialog de confirmação para marcar mensagem(ns) como spam */}
        <Dialog.Root
          open={email.showSpamConfirm}
          onOpenChange={(open) => {
            if (!open) {
              email.setShowSpamConfirm(false)
              email.setPendingSpamIds([])
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup
              variant="default"
              className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
            >
              <Dialog.Content>
                <Dialog.Header className="flex flex-row flex-wrap items-center gap-3 pb-3">
                  <Dialog.HeaderIcon>
                    <ShieldAlert className="h-4 w-4" />
                  </Dialog.HeaderIcon>
                  <Dialog.Title className="text-lg font-semibold text-gray-900 flex-1 min-w-0 pr-8">
                    Marcar como spam?
                  </Dialog.Title>
                  <Dialog.CloseButton aria-label="Fechar" />
                </Dialog.Header>
                <Dialog.Body className="flex-none">
                  <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                    <Dialog.BodyContent className="space-y-2 py-2">
                      <p className="text-sm text-gray-600">
                        {email.pendingSpamIds.length === 1
                          ? 'A mensagem será movida para a pasta Spam e o remetente poderá ser tratado como spam pelo Zoho Mail.'
                          : `${email.pendingSpamIds.length} mensagens serão movidas para a pasta Spam e os remetentes poderão ser tratados como spam pelo Zoho Mail.`}
                      </p>
                    </Dialog.BodyContent>
                  </Dialog.BodyViewport>
                </Dialog.Body>
                <Dialog.Footer className="flex flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      email.setShowSpamConfirm(false)
                      email.setPendingSpamIds([])
                    }}
                    disabled={email.isMarkingSpam}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="default"
                    onClick={email.handleConfirmSpam}
                    disabled={email.isMarkingSpam}
                    className="flex-1"
                  >
                    {email.isMarkingSpam ? 'Marcando...' : 'Marcar como spam'}
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  )
}

/**
 * Carregamento do e-mail do painel: o fallback da página e o `loading.tsx` da rota no host web (onda 135, A6), com a
 * marcação do carregamento da raiz legada.
 */
export function AdminEmailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-orange-600" />
    </div>
  )
}

export function AdminEmailPage() {
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

  return (
    <Suspense fallback={<AdminEmailLoading />}>
      <AdminEmailContent key={scope} />
    </Suspense>
  )
}
