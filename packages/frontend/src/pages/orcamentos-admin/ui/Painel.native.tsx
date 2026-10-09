import { Button } from '@gb-locacoes/ui'
import { View } from 'react-native'
import { space } from '@gb-locacoes/design-tokens'
import {
  createDefaultAdjustmentItem,
  formatDate,
  formatPaymentStatus,
  ADJUSTMENT_CATEGORY_LABEL,
} from '../../../entities/orcamento'
import {
  formatCurrency,
  formatDateForInput,
} from '../../../shared/lib/formatting'
import {
  quoteCustomerDraft,
  quoteDeliveryDraft,
  quoteItemDraft,
  quoteAdjustmentDraft,
} from '../model/editors'
import type { useQuoteDetailsModel } from '../model/detalhe'
import { useQuoteDocuments, type QuoteDocumentPorts } from '../model/documents'
import {
  QuoteChoices,
  QuoteDialog,
  QuoteSection,
  QuoteText,
  QuoteField,
} from './parts.native'
import { QuoteForms } from './Forms.native'
export function QuoteDetailPanel({
  model: m,
  ports,
}: {
  model: ReturnType<typeof useQuoteDetailsModel>
  ports: QuoteDocumentPorts & { navigate?: (path: string) => void }
}) {
  const q = m.selectedQuote,
    documents = useQuoteDocuments(q, ports)
  if (!q) return null
  const busy = m.isUpdating || m.isSendingAdjustedQuote,
    status = m.selectedQuoteStatus,
    p = m.boletoPayment
  const showPayment =
    status === 'pending' ||
    status === 'approved' ||
    status === 'completed' ||
    m.isAdminApproved
  const showBoleto =
    !!p &&
    (status === 'approved' || status === 'completed' || m.isAdminApproved)
  const paymentDisabled =
    !!p &&
    (m.updatingBoletoDueDateId === p.id ||
      ['PAID', 'CANCELLED', 'REFUNDED'].includes(p.status))
  return (
    <>
      <QuoteDialog
        open={!!q}
        title={'Detalhes do Orçamento - ' + (q.quoteCode || q.name)}
        onClose={() => m.setSelectedQuote(null)}
      >
        {ports.navigate ? (
          <Button
            variant="outline"
            onClick={() => {
              const lookup = (
                q.quoteCode ||
                q.legacyExternalCode ||
                q.name ||
                ''
              ).trim()
              if (!lookup) return
              const query = new URLSearchParams({ search: lookup })
              if (q.id) query.set('quoteId', q.id)
              ports.navigate?.('/admin/financeiro?' + query.toString())
            }}
          >
            Ver no Financeiro
          </Button>
        ) : null}
        <QuoteText>
          {q.status} · {formatCurrency(q.finalTotal ?? q.totalPrice)}
        </QuoteText>
        <QuoteSection title="Cliente">
          <QuoteText>
            {q.name} · {q.company || ''}
          </QuoteText>
          <QuoteText>
            {q.email} · {q.phone}
          </QuoteText>
          <QuoteText>{q.cpf || q.cnpj || 'Documento não informado'}</QuoteText>
          <QuoteText>
            {formatDate(q.startDate)} — {formatDate(q.endDate)}
          </QuoteText>
          <Button
            variant="outline"
            onClick={() => {
              m.setEditPeriodEmailPhoneDraft(quoteCustomerDraft(q))
              m.setShowEditPeriodEmailPhoneDialog(true)
            }}
          >
            Editar cliente
          </Button>
        </QuoteSection>
        <QuoteSection title="Entrega">
          <QuoteText>
            {q.deliveryType === 'DELIVERY'
              ? 'Entrega'
              : q.deliveryType === 'PICKUP'
                ? 'Retirada'
                : 'Não informada'}{' '}
            · Frete: {formatCurrency(q.deliveryFee ?? 0)}
          </QuoteText>
          <QuoteText>
            {Object.values(q.deliveryAddress || {})
              .filter(Boolean)
              .join(', ')}
          </QuoteText>
          <Button
            variant="outline"
            onClick={() => {
              m.setEditDeliveryDraft(
                quoteDeliveryDraft(q, m.selectedQuoteAdjustments, m.formatCEP)
              )
              m.setShowEditDeliveryDialog(true)
            }}
          >
            Editar entrega
          </Button>
        </QuoteSection>
        <QuoteSection title="Equipamentos">
          {(q.items || []).map((item) => (
            <View key={item.id} style={{ gap: space.sm }}>
              <QuoteText>
                {item.equipment?.name || 'Equipamento'} · {item.quantity}{' '}
                unidades · {item.days} dias
              </QuoteText>
              <QuoteText>
                {formatCurrency(item.total ?? 0)} ·{' '}
                {formatDate(item.startDate || q.startDate)} —{' '}
                {formatDate(item.endDate || q.endDate)}
              </QuoteText>
              <Button
                variant="outline"
                aria-label={'Editar período ' + item.id}
                onClick={() => {
                  m.setEditingQuoteItem(item)
                  m.setEditItemDatesDraft(quoteItemDraft(item))
                  m.setShowEditItemDatesDialog(true)
                }}
              >
                Editar período
              </Button>
              <Button
                variant="outline"
                aria-label={'Remover equipamento ' + item.id}
                disabled={!!m.removingItemId}
                onClick={() => m.setRemoveConfirmItemId(item.id)}
              >
                Remover equipamento
              </Button>
            </View>
          ))}
          {!q.items?.length
            ? q.equipments.map((item) => (
                <QuoteText key={item.id}>
                  {item.name} · {item.quantity} unidades ·{' '}
                  {formatCurrency(item.dailyPrice)}
                </QuoteText>
              ))
            : null}
        </QuoteSection>
        <QuoteSection title="Tipo de operação">
          <QuoteChoices
            value={m.editOperationType}
            options={[
              ['PURE_RENTAL', 'Locação pura'],
              ['RENTAL_WITH_SERVICE', 'Locação com serviço'],
            ]}
            disabled={m.isSavingOperationType}
            onChange={m.setEditOperationType}
          />
          {m.editOperationType === 'RENTAL_WITH_SERVICE' ? (
            <QuoteField
              label="Valor do serviço"
              value={m.editServiceAmount}
              disabled={m.isSavingOperationType}
              onChange={m.setEditServiceAmount}
            />
          ) : null}
          <Button
            disabled={m.isSavingOperationType}
            onClick={() => m.saveOperationType(q.id)}
          >
            {m.isSavingOperationType
              ? 'Salvando...'
              : 'Salvar tipo de operação'}
          </Button>
        </QuoteSection>
        {showPayment ? (
          <QuoteSection title="Boleto">
            {showBoleto && p ? (
              <>
                <QuoteText>
                  {formatPaymentStatus(p.status)} ·{' '}
                  {formatCurrency(
                    q.finalTotal ??
                      q.originalTotal ??
                      q.totalPrice ??
                      p.amount ??
                      0
                  )}
                </QuoteText>
                <QuoteText>Vencimento: {formatDate(p.dueDate)}</QuoteText>
                <QuoteField
                  label="Vencimento (AAAA-MM-DD)"
                  value={m.boletoDueDateDraft}
                  disabled={paymentDisabled}
                  onChange={m.setBoletoDueDateDraft}
                />
                <Button
                  disabled={
                    paymentDisabled ||
                    !m.boletoDueDateDraft ||
                    m.boletoDueDateDraft === formatDateForInput(p.dueDate)
                  }
                  onClick={() =>
                    m.handleUpdateBoletoDueDate(
                      q.id,
                      p.id,
                      m.boletoDueDateDraft
                    )
                  }
                >
                  Salvar vencimento
                </Button>
                {['PAID', 'CANCELLED', 'REFUNDED'].includes(p.status) ? (
                  <QuoteText>
                    Não é possível alterar vencimento para boleto pago,
                    cancelado ou estornado.
                  </QuoteText>
                ) : null}
                {p.metadata?.digitableLine ? (
                  <QuoteText>
                    Linha digitável: {p.metadata.digitableLine}
                  </QuoteText>
                ) : null}
                {p.metadata?.barcode ? (
                  <QuoteText>Código de barras: {p.metadata.barcode}</QuoteText>
                ) : null}
                {p.metadata?.pdfUrl ? (
                  <Button variant="outline" onClick={documents.openBoleto}>
                    Abrir boleto
                  </Button>
                ) : null}
                {p.metadata?.boletoSentAt ? (
                  <QuoteText>
                    Enviado em:{' '}
                    {new Date(p.metadata.boletoSentAt).toLocaleString('pt-BR')}
                  </QuoteText>
                ) : null}
              </>
            ) : (
              <>
                {status === 'pending' ? (
                  <>
                    <QuoteText>Condição de pagamento</QuoteText>
                    <QuoteChoices
                      value={m.approvalPaymentTerms}
                      options={[
                        ['UPFRONT', 'Antecipado'],
                        ['ON_DELIVERY', 'Na entrega'],
                        ['AT_END', 'No fim da locação'],
                      ]}
                      disabled={busy}
                      onChange={m.setApprovalPaymentTerms}
                    />
                  </>
                ) : null}
                <QuoteText>Nenhum boleto gerado ainda.</QuoteText>
              </>
            )}
            {status === 'approved' && !p?.metadata?.pdfUrl ? (
              <Button
                variant="outline"
                disabled={m.generatingBoletoId === q.id}
                onClick={() => m.handleGenerateBoleto(q.id)}
              >
                {m.generatingBoletoId === q.id ? 'Gerando...' : 'Gerar Boleto'}
              </Button>
            ) : null}
          </QuoteSection>
        ) : null}
        <QuoteSection title="Reajustes">
          <QuoteText>
            Original: {formatCurrency(m.selectedQuoteOriginalTotal)} · Final:{' '}
            {formatCurrency(q.finalTotal ?? q.totalPrice)}
          </QuoteText>
          {m.selectedQuoteAdjustments.map((adj) => (
            <View key={adj.id} style={{ gap: space.sm }}>
              <QuoteText>
                {ADJUSTMENT_CATEGORY_LABEL[adj.category]} ·{' '}
                {formatCurrency(adj.amount)} · {adj.justification}
              </QuoteText>
              <Button
                variant="outline"
                aria-label={'Editar reajuste ' + adj.id}
                onClick={() => {
                  m.setEditingAdjustmentId(adj.id)
                  m.setPriceAdjustmentItems([quoteAdjustmentDraft(adj)])
                  m.setShowPriceAdjustmentDialog(true)
                }}
              >
                Editar reajuste
              </Button>
              <Button
                variant="outline"
                aria-label={'Remover reajuste ' + adj.id}
                disabled={!!m.removingAdjustmentId}
                onClick={() => m.setRemoveConfirmAdjustmentId(adj.id)}
              >
                Remover reajuste
              </Button>
            </View>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              m.setEditingAdjustmentId(null)
              m.setPriceAdjustmentItems([createDefaultAdjustmentItem()])
              m.setShowPriceAdjustmentDialog(true)
            }}
          >
            Adicionar reajustes
          </Button>
          {m.selectedQuoteAdjustments.length ? (
            <Button
              variant="outline"
              disabled={documents.downloading}
              onClick={documents.downloadAdjustment}
            >
              {documents.downloading
                ? 'Baixando...'
                : 'Baixar PDF de reajustes'}
            </Button>
          ) : null}
        </QuoteSection>
        {q.rejectionReason ? (
          <QuoteText>Motivo da rejeição: {q.rejectionReason}</QuoteText>
        ) : null}
        {status === 'pending' ? (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={m.handleRejectClick}
            >
              {m.updatingAction === 'rejected'
                ? 'Rejeitando...'
                : 'Rejeitar Orçamento'}
            </Button>
            {m.shouldShowAdjustedSendButton ? (
              <Button
                disabled={busy}
                onClick={() => m.handleSendAdjustedQuote(q.id)}
              >
                {m.isSendingAdjustedQuote
                  ? 'Enviando...'
                  : 'Enviar Orçamento Ajustado'}
              </Button>
            ) : (
              <Button
                disabled={
                  m.isUpdating ||
                  (m.isAdminApproved && m.approvalPaymentTerms !== 'AT_END')
                }
                onClick={() =>
                  m.updateQuoteStatus(
                    q.id,
                    'approved',
                    undefined,
                    m.approvalPaymentTerms
                  )
                }
              >
                {m.updatingAction === 'approved'
                  ? m.approvalPaymentTerms === 'AT_END'
                    ? 'Convertendo...'
                    : 'Aprovando...'
                  : m.approvalPaymentTerms === 'AT_END'
                    ? 'Aprovar e Converter'
                    : 'Aprovar Orçamento'}
              </Button>
            )}
          </>
        ) : null}
        {status === 'approved' && m.shouldShowAdjustedSendButton ? (
          <Button
            disabled={busy}
            onClick={() => m.handleSendAdjustedQuote(q.id)}
          >
            Enviar Orçamento Ajustado
          </Button>
        ) : null}
        {status === 'approved' &&
        q.endDate &&
        new Date(q.endDate) < new Date() ? (
          <Button
            variant="outline"
            disabled={m.isCalculatingLateFee}
            onClick={() => m.calculateLateFee(q.id)}
          >
            {m.isCalculatingLateFee ? 'Calculando...' : 'Calcular Multa'}
          </Button>
        ) : null}
        {m.hasSelectedQuoteApproval ? (
          <Button
            variant="outline"
            disabled={m.isRemovingApproval}
            onClick={() => m.setShowRemoveApprovalDialog(true)}
          >
            Excluir aprovação
          </Button>
        ) : null}
        {status === 'rejected' || m.hasSelectedQuoteApproval ? (
          <Button
            variant="destructive"
            disabled={m.isDeleting}
            onClick={() => m.setShowDeleteDialog(true)}
          >
            Excluir Permanentemente
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => m.setSelectedQuote(null)}>
          Fechar detalhe
        </Button>
      </QuoteDialog>
      <QuoteForms model={m} />
    </>
  )
}
