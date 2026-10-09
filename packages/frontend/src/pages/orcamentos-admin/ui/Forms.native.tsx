import { Button, CurrencyInput } from '@gb-locacoes/ui'
import { View } from 'react-native'
import { space } from '@gb-locacoes/design-tokens'
import {
  ADJUSTMENT_CATEGORY_LABEL,
  type PriceAdjustmentItem,
} from '../../../entities/orcamento'
import { formatCurrency } from '../../../shared/lib/formatting'
import type { useQuoteDetailsModel } from '../model/detalhe'
import {
  QuoteDialog,
  QuoteText,
  QuoteField,
  QuoteChoices,
  QuoteConfirm,
} from './parts.native'
export function QuoteForms({
  model: m,
}: {
  model: ReturnType<typeof useQuoteDetailsModel>
}) {
  const q = m.selectedQuote
  if (!q) return null
  const customer = m.editPeriodEmailPhoneDraft,
    delivery = m.editDeliveryDraft,
    item = m.editItemDatesDraft
  const saving = (busy: boolean, onClick: () => void) => (
    <Button disabled={busy} onClick={onClick}>
      {busy ? 'Salvando...' : 'Salvar alterações'}
    </Button>
  )
  return (
    <>
      <QuoteDialog
        open={m.showEditPeriodEmailPhoneDialog}
        title="Editar dados do cliente"
        onClose={() => m.setShowEditPeriodEmailPhoneDialog(false)}
        footer={saving(m.isSavingPeriodEmailPhone, m.savePeriodEmailPhone)}
      >
        {(
          [
            ['startDate', 'Início (AAAA-MM-DD)'],
            ['endDate', 'Fim (AAAA-MM-DD)'],
            ['email', 'Email'],
            ['phone', 'Telefone'],
            ['cpf', 'CPF'],
            ['cnpj', 'CNPJ'],
            ['company', 'Empresa'],
          ] as const
        ).map(([key, label]) => (
          <QuoteField
            key={key}
            label={label}
            value={customer[key]}
            disabled={m.isSavingPeriodEmailPhone}
            onChange={(value) =>
              m.setEditPeriodEmailPhoneDraft((d) => ({ ...d, [key]: value }))
            }
          />
        ))}
        <Button
          variant="outline"
          disabled={m.isSavingPeriodEmailPhone}
          onClick={() =>
            m.setEditPeriodEmailPhoneDraft((d) => ({
              ...d,
              includeWeekends: !d.includeWeekends,
            }))
          }
        >
          {customer.includeWeekends
            ? 'Incluir fins de semana: sim'
            : 'Incluir fins de semana: não'}
        </Button>
      </QuoteDialog>
      <QuoteDialog
        open={m.showEditDeliveryDialog}
        title="Editar entrega e endereço"
        onClose={() => m.setShowEditDeliveryDialog(false)}
        footer={saving(m.isSavingDelivery, m.saveDelivery)}
      >
        <QuoteChoices
          value={delivery.deliveryType || ''}
          options={[
            ['DELIVERY', 'Entrega'],
            ['PICKUP', 'Retirada'],
          ]}
          onChange={(value) =>
            m.setEditDeliveryDraft((d) => ({
              ...d,
              deliveryType: value as 'DELIVERY' | 'PICKUP',
            }))
          }
          disabled={m.isSavingDelivery}
        />
        {(
          [
            ['deliveryFee', 'Frete'],
            ['street', 'Rua'],
            ['number', 'Número'],
            ['complement', 'Complemento'],
            ['neighborhood', 'Bairro'],
            ['city', 'Cidade'],
            ['state', 'Estado'],
            ['zipCode', 'CEP'],
          ] as const
        ).map(([key, label]) => (
          <QuoteField
            key={key}
            label={label}
            value={delivery[key]}
            disabled={
              m.isSavingDelivery ||
              (key === 'deliveryFee' && delivery.deliveryType === 'PICKUP')
            }
            onChange={(value) =>
              m.setEditDeliveryDraft((d) => ({
                ...d,
                [key]: key === 'zipCode' ? m.formatCEP(value) : value,
              }))
            }
          />
        ))}
      </QuoteDialog>
      <QuoteDialog
        open={m.showEditItemDatesDialog}
        title="Editar período do equipamento"
        onClose={() => m.setShowEditItemDatesDialog(false)}
        footer={saving(m.isSavingItemDates, m.saveItemDates)}
      >
        <QuoteField
          label="Início do item (AAAA-MM-DD)"
          value={item.startDate}
          disabled={m.isSavingItemDates}
          onChange={(startDate) =>
            m.setEditItemDatesDraft((d) => ({ ...d, startDate }))
          }
        />
        <QuoteField
          label="Fim do item (AAAA-MM-DD)"
          value={item.endDate}
          disabled={m.isSavingItemDates}
          onChange={(endDate) =>
            m.setEditItemDatesDraft((d) => ({ ...d, endDate }))
          }
        />
        <Button
          variant="outline"
          disabled={m.isSavingItemDates}
          onClick={() =>
            m.setEditItemDatesDraft((d) => ({
              ...d,
              includeWeekends: !d.includeWeekends,
            }))
          }
        >
          {item.includeWeekends
            ? 'Incluir fins de semana do item: sim'
            : 'Incluir fins de semana do item: não'}
        </Button>
        {m.editItemPreview ? (
          <QuoteText>
            {m.editItemPreview.days} dias ·{' '}
            {formatCurrency(m.editItemPreview.total)} ·{' '}
            {m.editItemPreview.periodLabel}
          </QuoteText>
        ) : null}
      </QuoteDialog>
      <QuoteDialog
        open={m.showPriceAdjustmentDialog}
        title={
          m.editingAdjustmentId ? 'Editar reajuste' : 'Reajustar orçamento'
        }
        onClose={() => m.setShowPriceAdjustmentDialog(false)}
        footer={
          <Button
            disabled={m.isAdjustingPrice}
            onClick={() => m.adjustQuotePrice(q.id)}
          >
            {m.isAdjustingPrice ? 'Aplicando...' : 'Aplicar reajuste'}
          </Button>
        }
      >
        <QuoteText>
          Valor original: {formatCurrency(m.selectedQuoteOriginalTotal)}
        </QuoteText>
        {m.priceAdjustmentItems.map((entry, index) => (
          <View key={entry.id} style={{ gap: space.sm }}>
            <QuoteText>Reajuste {index + 1}</QuoteText>
            <QuoteChoices
              value={entry.category}
              options={Object.entries(ADJUSTMENT_CATEGORY_LABEL).map(
                ([key, label]) =>
                  [key as PriceAdjustmentItem['category'], label] as const
              )}
              disabled={m.isAdjustingPrice}
              onChange={(category) =>
                m.updatePriceAdjustmentItem(entry.id, { category })
              }
            />
            {entry.category === 'OTHER' ? (
              <QuoteField
                label={'Outra categoria ' + (index + 1)}
                value={entry.categoryOther || ''}
                disabled={m.isAdjustingPrice}
                onChange={(categoryOther) =>
                  m.updatePriceAdjustmentItem(entry.id, { categoryOther })
                }
              />
            ) : null}
            <QuoteText>Valor do reajuste {index + 1}</QuoteText>
            <CurrencyInput
              aria-label={'Valor do reajuste ' + (index + 1)}
              value={entry.value}
              disabled={m.isAdjustingPrice}
              onValueChange={(value) =>
                m.updatePriceAdjustmentItem(entry.id, { value })
              }
            />
            <QuoteField
              label={'Justificativa ' + (index + 1)}
              value={entry.reason}
              disabled={m.isAdjustingPrice}
              onChange={(reason) =>
                m.updatePriceAdjustmentItem(entry.id, { reason })
              }
            />
            {!m.editingAdjustmentId && m.priceAdjustmentItems.length > 1 ? (
              <Button
                variant="outline"
                disabled={m.isAdjustingPrice}
                onClick={() => m.removePriceAdjustmentItem(entry.id)}
              >
                Remover reajuste {index + 1}
              </Button>
            ) : null}
          </View>
        ))}
        {!m.editingAdjustmentId ? (
          <Button
            variant="outline"
            disabled={m.isAdjustingPrice}
            onClick={m.addPriceAdjustmentItem}
          >
            Adicionar reajuste
          </Button>
        ) : null}
      </QuoteDialog>
      <QuoteDialog
        open={m.showRejectDialog}
        title="Rejeitar Orçamento"
        onClose={() => m.setShowRejectDialog(false)}
        footer={
          <Button disabled={m.isUpdating} onClick={m.handleConfirmReject}>
            {m.isUpdating ? 'Rejeitando...' : 'Confirmar rejeição'}
          </Button>
        }
      >
        <Button
          variant="outline"
          disabled={m.isUpdating}
          onClick={() => m.setRejectWithReason(!m.rejectWithReason)}
        >
          {m.rejectWithReason ? 'Informar motivo: sim' : 'Informar motivo: não'}
        </Button>
        {m.rejectWithReason ? (
          <QuoteField
            label="Motivo da rejeição"
            value={m.rejectionReason}
            disabled={m.isUpdating}
            onChange={m.setRejectionReason}
          />
        ) : null}
      </QuoteDialog>
      <QuoteDialog
        open={m.showLateFeeDialog}
        title="Multa por atraso"
        onClose={() => {
          m.setShowLateFeeDialog(false)
          m.setCalculatedLateFee(null)
        }}
        footer={
          <Button
            disabled={m.isUpdating}
            onClick={() => m.approveLateFee(q.id)}
          >
            {m.isUpdating ? 'Aplicando...' : 'Aprovar multa'}
          </Button>
        }
      >
        {m.calculatedLateFee ? (
          <QuoteText>
            {m.calculatedLateFee.daysLate} dias de atraso ·{' '}
            {formatCurrency(m.calculatedLateFee.lateFee)}
          </QuoteText>
        ) : null}
      </QuoteDialog>
      <QuoteConfirm
        open={m.showDeleteDialog}
        title="Excluir Orçamento Permanentemente?"
        message={
          'Confirme a exclusão do orçamento de ' +
          q.name +
          '. Esta ação não pode ser desfeita.'
        }
        busy={m.isDeleting}
        close={() => m.setShowDeleteDialog(false)}
        onConfirm={() => m.deleteQuote(q.id)}
      />
      <QuoteConfirm
        open={m.showRemoveApprovalDialog}
        title="Excluir Aprovação?"
        message="A aprovação será removida e o orçamento voltará ao status pendente."
        busy={m.isRemovingApproval}
        close={() => m.setShowRemoveApprovalDialog(false)}
        onConfirm={() => m.removeApproval(q.id)}
      />
      <QuoteConfirm
        open={!!m.removeConfirmItemId}
        title="Remover equipamento?"
        message="O equipamento será removido deste orçamento e o total será recalculado."
        busy={!!m.removingItemId}
        close={() => m.setRemoveConfirmItemId(null)}
        onConfirm={() => {
          if (m.removeConfirmItemId) {
            m.removeItemFromQuote(q.id, m.removeConfirmItemId)
            m.setRemoveConfirmItemId(null)
          }
        }}
      />
      <QuoteConfirm
        open={!!m.removeConfirmAdjustmentId}
        title="Remover reajuste?"
        message="O reajuste será removido e o valor final será recalculado."
        busy={!!m.removingAdjustmentId}
        close={() => m.setRemoveConfirmAdjustmentId(null)}
        onConfirm={() => {
          if (m.removeConfirmAdjustmentId)
            m.handleRemoveAdjustment(q.id, m.removeConfirmAdjustmentId)
        }}
      />
    </>
  )
}
