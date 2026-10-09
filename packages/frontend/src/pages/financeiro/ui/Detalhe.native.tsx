import { View } from 'react-native'
import { Button, CurrencyInput } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import type { useFinancialEntryDetailsModel } from '../model/detalhe'
import { useFinancialDocument } from '../model/document'
import type { FinancialFilePorts } from '../model/export'
import { formatFinancialDate } from '../model/display'
import {
  formatCurrency,
  formatDateForInput,
} from '../../../shared/lib/formatting'
import {
  statusLabel,
  REGIME_LABELS,
  OPERATION_TYPE_LABELS,
  ADJUSTMENT_CATEGORY_LABELS,
  createDefaultAdjustmentItem,
  type BillingStatus,
  type PriceAdjustmentItem,
} from '../model/tipos'
import {
  FinancialSection,
  FinancialText,
  FinancialChoices,
  FinancialField,
  FinancialDialog,
  FinancialConfirm,
} from './parts.native'
type Model = ReturnType<typeof useFinancialEntryDetailsModel>
export function FinancialDetail({
  model,
  files,
}: {
  model: Model
  files: FinancialFilePorts
}) {
  const entry = model.selectedEntry
  const oficio = useFinancialDocument(entry?.id ?? null, files)
  const canAdjust =
    entry?.quoteId &&
    entry.billingStatus !== 'PAID' &&
    entry.billingStatus !== 'SETTLED'
  return (
    <>
      <FinancialDialog
        open={Boolean(entry)}
        title="Detalhes do Lançamento"
        onClose={() => {
          if (!model.nestedDialogOpen) model.setSelectedEntry(null)
        }}
        footer={
          <Button
            variant="outline"
            onClick={() => model.setSelectedEntry(null)}
          >
            Fechar lançamento
          </Button>
        }
      >
        {entry ? (
          <>
            <FinancialSection title="Cliente e Orçamento">
              <FinancialText>
                {entry.customerName} · {entry.customerDocument} ·{' '}
                {entry.customerEmail || '-'}
              </FinancialText>
              <FinancialText>
                {entry.quoteCode ||
                  entry.legacyExternalCode ||
                  entry.quoteId ||
                  'Sem orçamento'}{' '}
                · {statusLabel[entry.billingStatus]}
              </FinancialText>
              <Button
                variant="outline"
                onClick={() => model.openQuoteFromEntry(entry)}
              >
                Ver orçamento
              </Button>
            </FinancialSection>
            <FinancialSection title="Valores e Tributação">
              <FinancialText>
                Bruto: {formatCurrency(entry.grossAmount)} · Líquido:{' '}
                {formatCurrency(entry.netAmount)}
              </FinancialText>
              <FinancialText>
                Retenção: {entry.taxRate}% · {entry.taxDocumentType} ·{' '}
                {entry.operationType
                  ? OPERATION_TYPE_LABELS[entry.operationType] ||
                    entry.operationType
                  : '-'}
              </FinancialText>
              <FinancialText>
                Regime:{' '}
                {entry.taxRegimeSnapshot
                  ? Object.entries(REGIME_LABELS).find(
                      ([key]) => key === entry.taxRegimeSnapshot
                    )?.[1] || entry.taxRegimeSnapshot
                  : '-'}
              </FinancialText>
              {entry.rentalAmount != null ? (
                <FinancialText>
                  Locação: {formatCurrency(entry.rentalAmount)}
                </FinancialText>
              ) : null}
              {entry.serviceAmount != null ? (
                <FinancialText>
                  Serviço: {formatCurrency(entry.serviceAmount)}
                </FinancialText>
              ) : null}
              {entry.taxBreakdown?.map((tax, index) => (
                <FinancialText key={tax.label + index}>
                  {tax.label}:{' '}
                  {tax.exempt ? 'Isento' : formatCurrency(Number(tax.amount))} ·
                  Base: {formatCurrency(Number(tax.baseAmount))} · {tax.rate}%
                </FinancialText>
              ))}
            </FinancialSection>
            <FinancialSection title="Status e Vencimento">
              <FinancialChoices<BillingStatus>
                value={entry.billingStatus}
                options={
                  Object.entries(statusLabel) as Array<[BillingStatus, string]>
                }
                disabled={model.savingStatusId === entry.id}
                onChange={(billingStatus) => {
                  void model.updateBillingStatus(entry.id, billingStatus)
                  model.setSelectedEntry({ ...entry, billingStatus })
                }}
              />
              <FinancialField
                label="Vencimento (AAAA-MM-DD)"
                value={model.dueDateDraft}
                onChange={model.setDueDateDraft}
                disabled={model.savingDueDateId === entry.id}
              />
              <Button
                disabled={
                  !model.dueDateDraft ||
                  model.dueDateDraft === formatDateForInput(entry.dueDate) ||
                  model.savingDueDateId === entry.id
                }
                onClick={() =>
                  void model.updateEntryDueDate(entry.id, model.dueDateDraft)
                }
              >
                Salvar vencimento
              </Button>
              {entry.dueDate &&
              new Date(entry.dueDate) < new Date() &&
              entry.billingStatus !== 'PAID' &&
              entry.billingStatus !== 'SETTLED' ? (
                <Button
                  variant="outline"
                  disabled={model.regeneratingBoletoId === entry.id}
                  onClick={() => void model.regenerateBoleto(entry.id)}
                >
                  {model.regeneratingBoletoId === entry.id
                    ? 'Solicitando...'
                    : 'Regenerar boleto'}
                </Button>
              ) : null}
            </FinancialSection>
            <FinancialSection title="Datas e Documentos">
              <FinancialText>
                Vencimento: {formatFinancialDate(entry.dueDate)}
              </FinancialText>
              <FinancialText>
                Boleto emitido: {formatFinancialDate(entry.boletoIssuedAt)}
              </FinancialText>
              <FinancialText>
                Nota fiscal {entry.invoiceNumber || '-'}:{' '}
                {formatFinancialDate(entry.invoiceIssuedAt)}
              </FinancialText>
              <FinancialText>
                Pago: {formatFinancialDate(entry.paidAt)} · Baixado:{' '}
                {formatFinancialDate(entry.settledAt)}
              </FinancialText>
              <Button variant="outline" onClick={() => void oficio()}>
                Baixar ofício
              </Button>
            </FinancialSection>
            {canAdjust ? (
              <FinancialSection title="Reajustes">
                {model.loadingAdjustments ? (
                  <FinancialText>Carregando reajustes...</FinancialText>
                ) : null}
                {model.adjustmentHistory.map((adjustment) => (
                  <View key={adjustment.id} style={{ gap: space.sm }}>
                    <FinancialText>
                      {ADJUSTMENT_CATEGORY_LABELS[adjustment.category] ||
                        adjustment.category}{' '}
                      · {formatCurrency(adjustment.amount)} ·{' '}
                      {adjustment.justification}
                    </FinancialText>
                    <FinancialText>
                      {formatFinancialDate(adjustment.createdAt)} ·{' '}
                      {adjustment.createdByUser?.name ||
                        adjustment.createdByUser?.email ||
                        '-'}{' '}
                      · E-mail:{' '}
                      {adjustment.sentEmailAt
                        ? formatFinancialDate(adjustment.sentEmailAt)
                        : 'Em processamento'}
                    </FinancialText>
                    <Button
                      variant="outline"
                      aria-label={'Editar reajuste ' + adjustment.id}
                      disabled={model.isAdjustingPrice}
                      onClick={() => {
                        const idx =
                          adjustment.category === 'OTHER'
                            ? adjustment.justification.indexOf(': ')
                            : -1
                        model.setEditingAdjustmentId(adjustment.id)
                        model.setPriceAdjustmentItems([
                          {
                            id: adjustment.id,
                            category:
                              adjustment.category as PriceAdjustmentItem['category'],
                            categoryOther:
                              idx >= 0
                                ? adjustment.justification.slice(0, idx)
                                : undefined,
                            reason:
                              idx >= 0
                                ? adjustment.justification.slice(idx + 2)
                                : adjustment.justification,
                            value: adjustment.amount,
                          },
                        ])
                        model.setShowPriceAdjustmentDialog(true)
                      }}
                    >
                      Editar reajuste
                    </Button>
                    <Button
                      variant="outline"
                      aria-label={'Excluir reajuste ' + adjustment.id}
                      disabled={model.deletingAdjustmentId === adjustment.id}
                      onClick={() => {
                        model.setAdjustmentToDelete({
                          id: adjustment.id,
                          quoteId: entry.quoteId!,
                        })
                        model.setShowAdjustmentDeleteConfirm(true)
                      }}
                    >
                      Excluir reajuste
                    </Button>
                  </View>
                ))}
                <Button
                  disabled={model.isAdjustingPrice}
                  onClick={() => {
                    model.setEditingAdjustmentId(null)
                    model.setPriceAdjustmentItems([
                      createDefaultAdjustmentItem(),
                    ])
                    model.setShowPriceAdjustmentDialog(true)
                  }}
                >
                  Novo reajuste
                </Button>
              </FinancialSection>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                model.setEntryIdToDelete(entry.id)
                model.setShowDeleteConfirm(true)
              }}
            >
              Excluir lançamento
            </Button>
          </>
        ) : null}
      </FinancialDialog>
      <FinancialDialog
        open={model.showPriceAdjustmentDialog}
        title={model.editingAdjustmentId ? 'Editar Reajuste' : 'Novo Reajuste'}
        onClose={() => {
          if (!model.isAdjustingPrice) model.setShowPriceAdjustmentDialog(false)
        }}
        footer={
          <Button
            disabled={
              model.isAdjustingPrice || !model.priceAdjustmentItems.length
            }
            onClick={() => {
              if (entry?.quoteId)
                void model.adjustQuotePriceForEntry(entry.quoteId)
            }}
          >
            {model.isAdjustingPrice ? 'Registrando...' : 'Registrar reajuste'}
          </Button>
        }
      >
        {model.priceAdjustmentItems.map((item, index) => (
          <FinancialSection key={item.id} title={'Item ' + (index + 1)}>
            <FinancialChoices<PriceAdjustmentItem['category']>
              value={item.category}
              disabled={model.isAdjustingPrice}
              options={[
                ['', 'Selecione a categoria'],
                [
                  'LABOR',
                  'Mão de Obra',
                  model.priceAdjustmentItems.some(
                    (other) =>
                      other.id !== item.id && other.category === 'LABOR'
                  ),
                ],
                [
                  'TRAVEL',
                  'Deslocamento',
                  model.priceAdjustmentItems.some(
                    (other) =>
                      other.id !== item.id && other.category === 'TRAVEL'
                  ),
                ],
                [
                  'MAINTENANCE',
                  'Manutenção',
                  model.priceAdjustmentItems.some(
                    (other) =>
                      other.id !== item.id && other.category === 'MAINTENANCE'
                  ),
                ],
                [
                  'OTHER',
                  'Outros',
                  model.priceAdjustmentItems.some(
                    (other) =>
                      other.id !== item.id && other.category === 'OTHER'
                  ),
                ],
              ]}
              onChange={(category) =>
                model.updatePriceAdjustmentItem(item.id, { category })
              }
            />
            {item.category === 'OTHER' ? (
              <FinancialField
                label={'Categoria específica ' + (index + 1)}
                value={item.categoryOther || ''}
                disabled={model.isAdjustingPrice}
                onChange={(categoryOther) =>
                  model.updatePriceAdjustmentItem(item.id, { categoryOther })
                }
              />
            ) : null}
            <FinancialText>Valor adicional</FinancialText>
            <CurrencyInput
              aria-label={'Valor adicional ' + (index + 1)}
              value={item.value}
              disabled={model.isAdjustingPrice}
              onValueChange={(value) =>
                model.updatePriceAdjustmentItem(item.id, { value: value || 0 })
              }
            />
            <FinancialField
              label={'Justificativa ' + (index + 1)}
              value={item.reason}
              disabled={model.isAdjustingPrice}
              onChange={(reason) =>
                model.updatePriceAdjustmentItem(item.id, { reason })
              }
            />
            <Button
              variant="outline"
              disabled={
                model.isAdjustingPrice ||
                model.priceAdjustmentItems.length === 1
              }
              onClick={() => model.removePriceAdjustmentItem(item.id)}
            >
              Remover item
            </Button>
          </FinancialSection>
        ))}
        {!model.editingAdjustmentId ? (
          <Button
            variant="outline"
            disabled={model.isAdjustingPrice}
            onClick={model.addPriceAdjustmentItem}
          >
            Adicionar item
          </Button>
        ) : null}
      </FinancialDialog>
      <FinancialConfirm
        open={model.showDeleteConfirm}
        title="Excluir Lançamento"
        message="Confirma a exclusão deste lançamento?"
        busy={model.isDeletingEntry}
        onConfirm={model.handleConfirmDeleteEntry}
        close={() => {
          if (!model.isDeletingEntry) {
            model.setShowDeleteConfirm(false)
            model.setEntryIdToDelete(null)
          }
        }}
      />
      <FinancialConfirm
        open={model.showAdjustmentDeleteConfirm}
        title="Excluir Reajuste"
        message="Confirma a exclusão deste reajuste e o recálculo do orçamento?"
        busy={Boolean(model.deletingAdjustmentId)}
        onConfirm={() => void model.handleConfirmDeleteAdjustment()}
        close={() => {
          if (!model.deletingAdjustmentId) {
            model.setShowAdjustmentDeleteConfirm(false)
            model.setAdjustmentToDelete(null)
          }
        }}
      />
    </>
  )
}
