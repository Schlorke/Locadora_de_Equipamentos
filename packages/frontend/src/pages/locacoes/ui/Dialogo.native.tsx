import { useMemo } from 'react'
import { View, Text } from 'react-native'
import { Button, Card, Dialog, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useScopedApiClient } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import type { useRentalsData } from '../model/carga'
import {
  clientDocumentTypeLabel,
  requiredClientDocumentTypes,
  rentalStatusLabels,
} from '../model/contracts'
import { formatCurrency, formatDate } from '../model/formatters'
export interface RentalDocumentPorts {
  pickDocument: () => Promise<FormData | null>
  openDocument: (url: string) => Promise<void>
}
export function RentalDetailDialog({
  model: m,
  ports,
}: {
  model: ReturnType<typeof useRentalsData>
  ports: RentalDocumentPorts
}) {
  const r = m.selectedRental,
    theme = useTheme(),
    text = { color: theme.text }
  const scope = useMemo(
      () => JSON.stringify([r?.id, r?.users.id]),
      [r?.id, r?.users.id]
    ),
    client = useScopedApiClient(scope)
  const open = async (url: string) => {
    if (!client.isCurrent()) return
    try {
      await ports.openDocument(url)
    } catch {
      if (client.isCurrent()) toast.error('Erro ao abrir documento')
    }
  }
  const title = (value: string) => (
    <Text
      accessibilityRole="header"
      style={{ ...text, fontSize: typography.size.lg }}
    >
      {value}
    </Text>
  )
  return (
    <Dialog.Root
      open={!!r}
      onOpenChange={(open) => {
        if (!open) m.setSelectedRental(null)
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Portal>
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Detalhes da Locação</Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  {r && (
                    <View style={{ gap: space.md }}>
                      <Card>
                        {title('Cliente')}
                        <Text style={text}>{r.users.name || 'N/A'}</Text>
                        <Text style={text}>{r.users.email}</Text>
                        <Text style={text}>{r.users.phone || 'N/A'}</Text>
                        <Text style={text}>
                          {rentalStatusLabels[r.status] || r.status}
                        </Text>
                      </Card>
                      <Card>
                        {title('Período de Locação')}
                        <Text style={text}>
                          Data de Início: {formatDate(r.startdate)}
                        </Text>
                        <Text style={text}>
                          Data de Término: {formatDate(r.enddate)}
                        </Text>
                        {!!r.extensionDays && (
                          <Text style={text}>
                            Prorrogação: {r.extensionDays} dias
                          </Text>
                        )}
                        {!!r.lateFee && (
                          <Text style={text}>
                            Multa por Atraso: {formatCurrency(r.lateFee)}
                          </Text>
                        )}
                      </Card>
                      <Card>
                        {title('Equipamentos')}
                        {r.rental_items.map((item) => (
                          <View key={item.id} style={{ gap: space.sm }}>
                            <Text style={text}>{item.equipments.name}</Text>
                            <Text style={text}>
                              Quantidade: {item.quantity} | Dias:{' '}
                              {item.totaldays}
                            </Text>
                            <Text style={text}>
                              {formatCurrency(item.totalprice)}
                            </Text>
                          </View>
                        ))}
                      </Card>
                      {!!r.payments?.length && (
                        <Card>
                          {title('Pagamentos')}
                          {r.payments.map((p) => (
                            <View key={p.id}>
                              <Text style={text}>
                                {formatCurrency(p.amount)} — {p.method} -{' '}
                                {p.status}
                              </Text>
                              {p.paidAt && (
                                <Text style={text}>{formatDate(p.paidAt)}</Text>
                              )}
                            </View>
                          ))}
                        </Card>
                      )}
                      <Text style={text}>
                        Valor Total: {formatCurrency(r.total)}
                      </Text>
                      {(r.status === 'PENDING' || r.status === 'ACTIVE') && (
                        <Card>
                          {title('Check-in/Check-out')}
                          {!r.checkInAt && (
                            <Button onClick={() => void m.handleCheckIn(r.id)}>
                              Realizar Check-in
                            </Button>
                          )}
                          {r.checkInAt && !r.checkOutAt && (
                            <Button
                              variant="outline"
                              onClick={() => void m.handleCheckOut(r.id)}
                            >
                              Realizar Check-out
                            </Button>
                          )}
                          {r.checkInAt && (
                            <Text style={text}>
                              Check-in: {formatDate(r.checkInAt)}
                            </Text>
                          )}
                          {r.checkOutAt && (
                            <Text style={text}>
                              Check-out: {formatDate(r.checkOutAt)}
                            </Text>
                          )}
                        </Card>
                      )}
                      <Card>
                        {title('Contrato')}
                        <Text style={text}>
                          {r.contract?.status || 'Não gerado'}
                        </Text>
                        {r.contract?.signedAt && (
                          <Text style={text}>
                            Assinado em: {formatDate(r.contract.signedAt)}
                          </Text>
                        )}
                        <Button
                          variant="outline"
                          disabled={m.contractLoading}
                          onClick={() => void m.handleGenerateContract(r.id)}
                        >
                          {r.contract ? 'Atualizar contrato' : 'Gerar contrato'}
                        </Button>
                        {r.contract?.pdfUrl && (
                          <Button
                            variant="outline"
                            onClick={() => void open(r.contract!.pdfUrl!)}
                          >
                            Abrir PDF
                          </Button>
                        )}
                      </Card>
                      <Card>
                        {title('Documentos do Cliente (Antifraude)')}
                        {requiredClientDocumentTypes.map((type) => {
                          const doc = m.clientDocuments.find(
                            (d) => d.type === type
                          )
                          return (
                            <View
                              key={type}
                              style={{
                                gap: space.sm,
                                paddingVertical: space.sm,
                              }}
                            >
                              <Text accessibilityRole="header" style={text}>
                                {clientDocumentTypeLabel[type]}
                              </Text>
                              <Text
                                style={{
                                  color: doc ? theme.textMuted : theme.danger,
                                }}
                              >
                                {doc
                                  ? 'Enviado em ' +
                                    formatDate(doc.createdAt) +
                                    ' • ' +
                                    doc.fileName
                                  : 'Documento obrigatório pendente'}
                              </Text>
                              {doc?.signedUrl && (
                                <Button
                                  variant="outline"
                                  aria-label={
                                    'Visualizar ' +
                                    clientDocumentTypeLabel[type]
                                  }
                                  onClick={() => void open(doc.signedUrl!)}
                                >
                                  Visualizar
                                </Button>
                              )}
                              <Button
                                aria-label={
                                  (doc ? 'Substituir ' : 'Enviar ') +
                                  clientDocumentTypeLabel[type]
                                }
                                disabled={
                                  m.documentSelecting ||
                                  !!m.uploadingDocumentType
                                }
                                onClick={() =>
                                  void m.selectClientDocument(
                                    type,
                                    ports.pickDocument
                                  )
                                }
                              >
                                {m.uploadingDocumentType === type
                                  ? 'Enviando...'
                                  : doc
                                    ? 'Substituir'
                                    : 'Enviar'}
                              </Button>
                            </View>
                          )
                        })}
                      </Card>
                    </View>
                  )}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="outline"
                onClick={() => m.setSelectedRental(null)}
              >
                Fechar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
