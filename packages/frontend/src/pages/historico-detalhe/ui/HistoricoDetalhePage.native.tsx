import { useCallback, useState, type ReactNode } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Link,
  toast,
  useNavigate,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography, semanticThemes } from '@gb-locacoes/design-tokens'
import { usePublicSettings } from '../../../entities/configuracao'
import {
  parseAdjustmentBlocks,
  ADJUSTMENT_CATEGORY_LABELS,
} from '../../../entities/orcamento'
import { EquipmentQuotePriceBlock } from '../../../features/bloco-preco'
import { isAbortError, HttpError } from '../../../shared/api'
import {
  useRentalDetail,
  useRentalDetailScope,
} from '../model/use-rental-detail'
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  coerceNumber,
  getRentalTotals,
  getQuoteItemPrice,
  getRentalQuoteItemPrice,
} from '../model/presentation'
import { quoteTimeline, rentalTimeline } from '../model/timeline'
import type { TimelineStep } from '../model/types'

interface NativeDetailsProps {
  paramId: string | null
  resolveAssetUrl?: (src: string) => string
  onDownload?: (file: {
    blob: Blob
    name: string
    isCurrent: () => boolean
  }) => Promise<void>
}
const labels: Record<string, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativa',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  completed: 'Concluído',
}
export function RentalDetailsPage(props: NativeDetailsProps) {
  return <DetailContent key={useRentalDetailScope(props.paramId)} {...props} />
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.text,
            fontSize: typography.size.lg,
            fontWeight: typography.weight.semibold,
          }}
        >
          {title}
        </Text>
        {children}
      </View>
    </Card>
  )
}
function Timeline({ steps }: { steps: TimelineStep[] }) {
  const theme = useTheme()
  return (
    <Section title="Linha do Tempo">
      {steps.map((step) => (
        <View key={step.id} style={{ gap: space.xs }}>
          <Text
            style={{
              color:
                step.status === 'completed'
                  ? semanticThemes.light.feedback.success
                  : step.status === 'current'
                    ? theme.primary
                    : theme.textMuted,
              fontWeight: typography.weight.semibold,
            }}
          >
            {step.label}
          </Text>
          <Text style={{ color: theme.textMuted }}>
            {step.status === 'completed'
              ? 'Concluído'
              : step.status === 'current'
                ? 'Atual'
                : 'Pendente'}
            {step.date ? ' · ' + formatDate(step.date.toString()) : ''}
          </Text>
          {step.description ? (
            <Text style={{ color: theme.textMuted }}>{step.description}</Text>
          ) : null}
        </View>
      ))}
    </Section>
  )
}
function DetailContent({
  paramId,
  onDownload,
  resolveAssetUrl = (value) => value,
}: NativeDetailsProps) {
  const navigate = useNavigate(),
    theme = useTheme(),
    { settings } = usePublicSettings()
  const go = useCallback(
    (href: string) => {
      void navigate?.(href)
    },
    [navigate]
  )
  const m = useRentalDetail(paramId, go),
    { rental, quote } = m
  const [action, setAction] = useState<'extend' | 'pickup' | null>(null),
    [days, setDays] = useState('7'),
    [busy, setBusy] = useState(false)
  const actionRequest = async () => {
    if (!rental || busy) return
    const extensionDays = parseInt(days, 10)
    if (
      action === 'extend' &&
      (isNaN(extensionDays) || extensionDays < 1 || extensionDays > 30)
    ) {
      toast.error('Por favor, insira um número válido entre 1 e 30')
      return
    }
    try {
      setBusy(true)
      if (action === 'extend') {
        const data = await m.rentalApi.extend(rental.id, extensionDays)
        if (!m.client.isCurrent()) return
        toast.success(
          'Prorrogação de ' +
            extensionDays +
            ' dias solicitada com sucesso. Taxa adicional: ' +
            formatCurrency(data.extensionFee || 0)
        )
      } else {
        await m.rentalApi.requestPickup(rental.id)
        if (!m.client.isCurrent()) return
        toast.success(
          'Solicitação de coleta enviada. Nossa equipe entrará em contato em breve.'
        )
      }
      if (!m.client.isCurrent()) return
      setAction(null)
      void m.fetchRental()
    } catch (error) {
      if (isAbortError(error) || !m.client.isCurrent()) return
      toast.error(
        error instanceof HttpError
          ? error.message
          : action === 'extend'
            ? 'Erro ao solicitar prorrogação'
            : 'Erro ao solicitar coleta'
      )
    } finally {
      if (m.client.isCurrent()) setBusy(false)
    }
  }
  const download = async () => {
    if (!rental || busy) return
    try {
      setBusy(true)
      const response = await m.rentalApi.downloadContract(rental.id)
      if (!m.client.isCurrent()) return
      if (!response.ok || !onDownload) throw new Error('Download indisponível')
      await onDownload({
        blob: response.blob,
        name: 'contrato-' + rental.id + '.html',
        isCurrent: m.client.isCurrent,
      })
      if (m.client.isCurrent()) toast.success('Contrato baixado com sucesso')
    } catch (error) {
      if (!isAbortError(error) && m.client.isCurrent())
        toast.error('Erro ao baixar contrato')
    } finally {
      if (m.client.isCurrent()) setBusy(false)
    }
  }
  if (m.loading) return <ActivityIndicator />
  if (!rental && !quote)
    return (
      <Card>
        <Text>
          {m.isQuote ? 'Orçamento não encontrado' : 'Locação não encontrada'}
        </Text>
        <Link href="/area-cliente">Voltar para Área do Cliente</Link>
      </Card>
    )
  const quoteTotal =
    quote?.finalTotal ?? quote?.originalTotal ?? quote?.totalPrice ?? 0
  const totals = rental ? getRentalTotals(rental) : null
  const payments = quote?.payments || rental?.payments || []
  const address = quote?.deliveryAddress || rental?.quote?.deliveryAddress
  const quoteItems = quote?.items || []
  const rentalQuoteItems = rental?.quote?.items || []
  const deliveryFee = coerceNumber(
      quote?.deliveryFee ?? rental?.quote?.deliveryFee
    ),
    pickupFee = coerceNumber(quote?.pickupFee ?? rental?.quote?.pickupFee)
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/area-cliente/historico">Voltar para Histórico</Link>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        {quote ? 'Detalhes do Orçamento' : 'Detalhes da Locação'}
      </Text>
      <Text style={{ color: theme.textMuted }}>
        {quote
          ? 'Código: ' +
            (quote.quoteCode || quote.legacyExternalCode || quote.id)
          : 'Locação #' + rental?.id}
      </Text>
      <Badge>
        {labels[quote?.status || rental?.status || ''] || 'Desconhecido'}
      </Badge>
      {quote ? (
        <Section title="Informações do Cliente">
          <Text style={{ color: theme.text }}>{quote.name}</Text>
          <Text style={{ color: theme.textMuted }}>
            {quote.email} · {quote.phone}
          </Text>
          {quote.company ? (
            <Text style={{ color: theme.textMuted }}>{quote.company}</Text>
          ) : null}
        </Section>
      ) : null}
      {quote &&
      ((quote.adjustments?.length ?? 0) > 0 || quote.priceAdjustmentReason) &&
      quote.finalTotal != null ? (
        <Section title="Valor do orçamento foi reajustado">
          <Text style={{ color: theme.textMuted }}>
            Valor original:{' '}
            {formatCurrency(quote.originalTotal ?? quote.totalPrice)}
          </Text>
          <Text style={{ color: theme.text }}>
            Valor reajustado: {formatCurrency(quoteTotal)}
          </Text>
          <Button
            variant="outline"
            onClick={() => m.setShowAdjustmentDialog(true)}
          >
            Ver Reajuste
          </Button>
        </Section>
      ) : null}
      <Section title="Equipamentos">
        {quoteItems.map((item) => {
          const price = getQuoteItemPrice(item)
          return (
            <View key={item.id} style={{ gap: space.sm }}>
              {item.equipment.images?.[0] ? (
                <Image
                  accessibilityLabel={item.equipment.name}
                  source={{ uri: resolveAssetUrl(item.equipment.images[0]) }}
                  style={{ width: space.xxl, height: space.xxl }}
                />
              ) : null}
              <EquipmentQuotePriceBlock
                equipmentName={item.equipment.name}
                originalPrice={price.originalPrice}
                finalPrice={price.finalPrice}
                variant={price.variant}
                contentBeforeFinalPrice={
                  <Text style={{ color: theme.textMuted }}>
                    Qtd: {price.quantity}x · {price.days} dias
                  </Text>
                }
              />
              <Text style={{ color: theme.textMuted }}>
                {formatDateShort(item.startDate)} até{' '}
                {formatDateShort(item.endDate)}
              </Text>
              {item.includeWeekends != null ? (
                <Text style={{ color: theme.textMuted }}>
                  {item.includeWeekends
                    ? 'Inclui finais de semana'
                    : 'Não inclui finais de semana'}
                </Text>
              ) : null}
            </View>
          )
        })}
        {rental?.rental_items.map((item) => (
          <View key={item.id} style={{ gap: space.xs }}>
            {item.equipments.images[0] ? (
              <Image
                accessibilityLabel={item.equipments.name}
                source={{ uri: resolveAssetUrl(item.equipments.images[0]) }}
                style={{ width: space.xxl, height: space.xxl }}
              />
            ) : null}
            <Text
              style={{
                color: theme.text,
                fontWeight: typography.weight.semibold,
              }}
            >
              {item.equipments.name}
            </Text>
            <Text style={{ color: theme.textMuted }}>
              {item.quantity}x · {item.totaldays} dias
            </Text>
            <Text style={{ color: theme.text }}>
              {formatCurrency(coerceNumber(item.totalprice))}
            </Text>
          </View>
        ))}
      </Section>
      <Section title="Período de Locação">
        {rentalQuoteItems.length ? (
          rentalQuoteItems.map((item) => (
            <View key={item.id}>
              <Text style={{ color: theme.text }}>{item.equipment.name}</Text>
              <Text style={{ color: theme.textMuted }}>
                {formatDate(item.startDate)} até {formatDate(item.endDate)}
              </Text>
            </View>
          ))
        ) : rental ? (
          <Text style={{ color: theme.textMuted }}>
            {formatDate(rental.startdate)} até {formatDate(rental.enddate)}
          </Text>
        ) : (
          quoteItems.map((item) => (
            <Text key={item.id} style={{ color: theme.textMuted }}>
              {item.equipment.name}: {formatDate(item.startDate)} até{' '}
              {formatDate(item.endDate)}
            </Text>
          ))
        )}
        {rental?.extensionDays ? (
          <Text style={{ color: theme.textMuted }}>
            Prorrogação: {rental.extensionDays} dias
          </Text>
        ) : null}
      </Section>
      {address || deliveryFee || pickupFee || rental?.deliveries?.length ? (
        <Section title="Entrega e Coleta">
          {address ? (
            <Text style={{ color: theme.textMuted }}>
              {[
                address.street,
                address.number,
                address.complement,
                address.neighborhood,
                address.city,
                address.state,
                address.zipCode,
              ]
                .filter(Boolean)
                .join(' - ')}
            </Text>
          ) : null}
          <Text style={{ color: theme.textMuted }}>
            Frete: {formatCurrency(deliveryFee + pickupFee)} (incluído no total)
          </Text>
          {rental?.deliveries?.map((d) => (
            <Text key={d.id} style={{ color: theme.textMuted }}>
              {d.type} · {d.status} · {formatDate(d.scheduledAt)}
              {d.completedAt ? ' · ' + formatDate(d.completedAt) : ''}
            </Text>
          ))}
        </Section>
      ) : null}
      <Timeline
        steps={quote ? quoteTimeline(quote) : rentalTimeline(rental!)}
      />
      <Section title="Total">
        {rentalQuoteItems.map((item) => {
          const price = getRentalQuoteItemPrice(item)
          return (
            <EquipmentQuotePriceBlock
              key={item.id}
              equipmentName={price.itemLabel}
              originalPrice={price.originalPrice}
              finalPrice={price.finalPrice}
              variant={price.variant}
            />
          )
        })}
        {totals?.lateFeeValue ? (
          <Text style={{ color: theme.danger }}>
            Multa: {formatCurrency(totals.lateFeeValue)}
          </Text>
        ) : null}
        <Text
          style={{
            color: semanticThemes.light.feedback.success,
            fontWeight: typography.weight.bold,
          }}
        >
          Total a Pagar:{' '}
          {formatCurrency(
            totals ? totals.displayTotal + totals.lateFeeValue : quoteTotal
          )}
        </Text>
      </Section>
      {payments.length ? (
        <Section title="Status do Pagamento">
          {payments.map((payment) => (
            <View key={payment.id} style={{ gap: space.xs }}>
              <Text style={{ color: theme.text }}>
                {formatCurrency(coerceNumber(payment.amount))} ·{' '}
                {payment.method} · {payment.paidAt ? 'Pago' : 'Pendente'}
              </Text>
              <Text style={{ color: theme.textMuted }}>
                Vencimento: {formatDateShort(payment.dueDate)}
              </Text>
              {payment.method === 'BOLETO' && payment.metadata?.pdfUrl ? (
                <Link href={payment.metadata.pdfUrl}>Baixar Boleto</Link>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}
      {rental?.notes ? (
        <Section title="Observações">
          <Text style={{ color: theme.textMuted }}>{rental.notes}</Text>
        </Section>
      ) : null}
      <Section title="Ações">
        {rental &&
        (rental.status === 'ACTIVE' || rental.status === 'OVERDUE') ? (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setAction('extend')}
            >
              Solicitar Prorrogação
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setAction('pickup')}
            >
              Solicitar Coleta
            </Button>
          </>
        ) : null}
        {quote?.status === 'pending' ? (
          <Button variant="outline" onClick={() => m.setShowDeleteDialog(true)}>
            Cancelar Orçamento
          </Button>
        ) : null}
        <Link
          href={
            'tel:+' +
            (settings.whatsappNumber.replace(/\D/g, '').startsWith('55')
              ? ''
              : '55') +
            settings.whatsappNumber.replace(/\D/g, '')
          }
        >
          Entrar em Contato
        </Link>
        {rental ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void download()}
          >
            Baixar Contrato
          </Button>
        ) : null}
      </Section>
      <Dialog.Root
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>
              {action === 'extend'
                ? 'Solicitar Prorrogação'
                : 'Solicitar Coleta'}
            </Dialog.Title>
            <Dialog.Description>
              {action === 'extend'
                ? 'Quantos dias deseja prorrogar? (máximo 30 dias)'
                : 'Deseja solicitar a coleta do equipamento? Nossa equipe entrará em contato para agendar.'}
            </Dialog.Description>
            {action === 'extend' ? (
              <Input
                type="number"
                value={days}
                onChangeText={setDays}
                aria-label="Dias de prorrogação"
              />
            ) : null}
            <Button disabled={busy} onClick={() => void actionRequest()}>
              {busy ? 'Enviando...' : 'Confirmar Solicitação'}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={m.showDeleteDialog}
        onOpenChange={m.setShowDeleteDialog}
      >
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>Cancelar orçamento?</Dialog.Title>
            <Dialog.Description>
              Esta ação não pode ser desfeita.
            </Dialog.Description>
            <Button
              disabled={m.isDeletingQuote}
              onClick={() => void m.handleDeleteQuote()}
            >
              Sim, cancelar
            </Button>
            <Button
              variant="outline"
              disabled={m.isDeletingQuote}
              onClick={() => m.setShowDeleteDialog(false)}
            >
              Voltar
            </Button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={m.showAdjustmentDialog}
        onOpenChange={m.setShowAdjustmentDialog}
      >
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>Detalhes do Reajuste</Dialog.Title>
            {quote?.adjustments?.map((a) => (
              <Text key={a.id} style={{ color: theme.text }}>
                {ADJUSTMENT_CATEGORY_LABELS[
                  a.category as keyof typeof ADJUSTMENT_CATEGORY_LABELS
                ] || a.category}
                : {formatCurrency(a.amount)} · {a.justification}
              </Text>
            ))}
            {!quote?.adjustments?.length && quote?.priceAdjustmentReason
              ? parseAdjustmentBlocks(quote.priceAdjustmentReason).map(
                  (block, index) => (
                    <Text key={index} style={{ color: theme.textMuted }}>
                      {block.category}: {block.justification}
                    </Text>
                  )
                )
              : null}
            {quote?.status === 'pending' ? (
              <Button
                variant="outline"
                onClick={() => {
                  m.setShowAdjustmentDialog(false)
                  m.setShowDeleteDialog(true)
                }}
              >
                Cancelar Orçamento
              </Button>
            ) : null}
            <Dialog.Close render={<Button variant="outline">Fechar</Button>} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </ScrollView>
  )
}
