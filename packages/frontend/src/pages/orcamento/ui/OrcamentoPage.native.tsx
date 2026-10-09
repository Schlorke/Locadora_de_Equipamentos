import { useMemo, useState, type ReactNode } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import {
  AddressForm,
  Button,
  Card,
  Checkbox,
  Dialog,
  Input,
  Link,
  Textarea,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { storefrontLegalItemParts } from '@gb-locacoes/contracts/storefront-legal'
import { fetchAddressByCEP } from '../../../shared/lib/cep'
import { formatCurrency } from '../../../shared/lib/moeda'
import { useQuotePage, useQuotePageScope } from '../model/use-quote-page'
import { useQuotePreferences } from '../model/use-quote-preferences'
import type {
  NativeQuotePageProps,
  QuotePagePorts,
} from '../model/quote-page-contract'

export function QuotePageWrapper(props: NativeQuotePageProps) {
  return <PreparedQuotePage key={useQuotePageScope()} {...props} />
}
function PreparedQuotePage(props: NativeQuotePageProps) {
  const p = useQuotePreferences(props.storage),
    theme = useTheme()
  const query = useMemo(
    () => ({
      get: (key: string) =>
        key === 'equipmentId' ? (props.equipmentId ?? null) : null,
    }),
    [props.equipmentId]
  )
  const ports = useMemo(
    () =>
      p.preferences
        ? {
            preferences: p.preferences,
            query,
            clearQuery: props.clearQuery,
            image: props.image,
          }
        : null,
    [p.preferences, query, props.clearQuery, props.image]
  )
  if (!ports)
    return (
      <View style={{ padding: space.md, gap: space.md }}>
        {p.error ? (
          <>
            <Text accessibilityRole="alert" style={{ color: theme.danger }}>
              {p.error}
            </Text>
            <Button onClick={p.retry}>Tentar novamente</Button>
          </>
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando orçamento" />
        )}
      </View>
    )
  return <QuoteContent ports={ports} />
}
function Confirmation({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose(): void
  children: ReactNode
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.BodyViewport>
            <Dialog.BodyContent>{children}</Dialog.BodyContent>
          </Dialog.BodyViewport>
          <Dialog.Footer>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
function QuoteContent({ ports }: { ports: QuotePagePorts }) {
  const m = useQuotePage(ports),
    theme = useTheme(),
    [termsOpen, setTermsOpen] = useState(false)
  const text = { color: theme.text },
    muted = { color: theme.textMuted }
  const heading = {
    ...text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  }
  const row = {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: space.sm,
    alignItems: 'center' as const,
  }
  const setField = (
    key: 'name' | 'email' | 'cep' | 'company' | 'message',
    value: string
  ) => m.setFormData((prev) => ({ ...prev, [key]: value }))
  const formAddress = m.formData.deliveryAddress ?? {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  }
  const customerInfo = m.getNewCustomerInfoToSave()
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/">Voltar para início</Link>
      <Text
        accessibilityRole="header"
        style={{ ...heading, fontSize: typography.size.xl }}
      >
        Solicitar Orçamento
      </Text>
      <Text style={muted}>
        Selecione equipamentos, revise o período e envie sua solicitação.
      </Text>
      <Card>
        <View style={{ gap: space.md }}>
          <Text style={heading}>Equipamentos selecionados</Text>
          {m.displayedItems.length === 0 ? (
            <Text style={muted}>
              Nenhum equipamento selecionado. Você também pode solicitar um
              orçamento geral.
            </Text>
          ) : (
            m.displayedItems.map((item) => {
              const dates = m.resolveDateRange(item)
              return (
                <View key={item.equipmentId} style={{ gap: space.sm }}>
                  {ports.image && item.images?.[0]
                    ? ports.image({
                        src: item.images[0],
                        alt: item.equipmentName,
                        height: space.xxl + space.xxl,
                      })
                    : null}
                  <Text style={heading}>{item.equipmentName}</Text>
                  <Text style={muted}>{item.description}</Text>
                  <Text style={text}>
                    {m.formatDate(dates.startDate)} até{' '}
                    {m.formatDate(dates.endDate)}
                    {dates.isAuto ? ' (período automático)' : ''}
                  </Text>
                  <View style={row}>
                    <Text style={text}>Quantidade</Text>
                    <Button
                      variant="outline"
                      aria-label={
                        'Diminuir quantidade de ' + item.equipmentName
                      }
                      onClick={() =>
                        m.updateQuantity(item.equipmentId, item.quantity - 1)
                      }
                    >
                      −
                    </Button>
                    <Text style={text}>{item.quantity}</Text>
                    <Button
                      variant="outline"
                      aria-label={
                        'Aumentar quantidade de ' + item.equipmentName
                      }
                      onClick={() =>
                        m.updateQuantity(item.equipmentId, item.quantity + 1)
                      }
                    >
                      +
                    </Button>
                  </View>
                  <View style={row}>
                    <Text style={text}>Dias de locação</Text>
                    <Button
                      variant="outline"
                      aria-label={'Diminuir dias de ' + item.equipmentName}
                      onClick={() =>
                        m.updateDays(
                          item.equipmentId,
                          Math.max(1, item.days - 1)
                        )
                      }
                    >
                      −
                    </Button>
                    <Text style={text}>{item.days}</Text>
                    <Button
                      variant="outline"
                      aria-label={'Aumentar dias de ' + item.equipmentName}
                      onClick={() =>
                        m.updateDays(item.equipmentId, item.days + 1)
                      }
                    >
                      +
                    </Button>
                  </View>
                  <Text style={text}>
                    Subtotal: {formatCurrency(m.calculateSubtotal(item))}
                  </Text>
                  {m.availabilityErrors[item.equipmentId] ? (
                    <Text
                      accessibilityRole="alert"
                      style={{ color: theme.danger }}
                    >
                      {m.availabilityErrors[item.equipmentId]}
                    </Text>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => m.removeEquipment(item.equipmentId)}
                  >
                    Remover {item.equipmentName}
                  </Button>
                </View>
              )
            })
          )}
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.md }}>
          <Text style={heading}>Seus dados</Text>
          <Text style={text}>Nome Completo *</Text>
          <Input
            id="name"
            aria-label="Nome Completo"
            value={m.formData.name}
            onChangeText={(v) => setField('name', v)}
            disabled={m.isSubmitting}
          />
          <Text style={text}>E-mail *</Text>
          <Input
            id="email"
            aria-label="E-mail"
            type="email"
            value={m.formData.email}
            onChangeText={(v) => setField('email', v)}
            disabled={m.isSubmitting}
          />
          <Text style={text}>Telefone *</Text>
          <Input
            id="phone"
            aria-label="Telefone"
            value={m.formData.phone}
            onChangeText={(v) => m.handlePhoneChange({ target: { value: v } })}
            disabled={m.isSubmitting}
          />
          <Text style={text}>CPF</Text>
          <Input
            id="cpf"
            aria-label="CPF"
            value={m.formData.cpf}
            onChangeText={(v) => m.handleCPFChange({ target: { value: v } })}
            disabled={m.isSubmitting}
          />
          <Text style={text}>CNPJ</Text>
          <Input
            id="cnpj"
            aria-label="CNPJ"
            value={m.formData.cnpj}
            onChangeText={(v) => m.handleCNPJChange({ target: { value: v } })}
            disabled={m.isSubmitting}
          />
          <Text style={text}>Empresa</Text>
          <Input
            id="company"
            aria-label="Empresa"
            value={m.formData.company}
            onChangeText={(v) => setField('company', v)}
            disabled={m.isSubmitting}
          />
          <Text style={text}>CEP</Text>
          <Input
            id="cep"
            aria-label="CEP"
            value={m.formData.cep}
            onChangeText={(v) => setField('cep', v)}
            disabled={m.isSubmitting}
          />
          <Text style={text}>Observações</Text>
          <Textarea
            value={m.formData.message}
            onChangeText={(v) => setField('message', v)}
            disabled={m.isSubmitting}
            placeholder="Detalhes adicionais sobre sua solicitação"
          />
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.md }}>
          <Text style={heading}>Entrega ou retirada</Text>
          <View style={row}>
            <Button
              variant={
                m.formData.deliveryType === 'PICKUP' ? 'default' : 'outline'
              }
              disabled={m.isSubmitting}
              onClick={() => void m.handleDeliveryTypeChange('PICKUP')}
            >
              Retirada no local
            </Button>
            <Button
              variant={
                m.formData.deliveryType === 'DELIVERY' ? 'default' : 'outline'
              }
              disabled={m.isSubmitting}
              onClick={() => void m.handleDeliveryTypeChange('DELIVERY')}
            >
              Entrega no endereço
            </Button>
          </View>
          {m.formData.deliveryType === 'DELIVERY' ? (
            <>
              <AddressForm
                value={formAddress}
                onChange={(address) =>
                  m.setFormData((prev) => ({
                    ...prev,
                    deliveryAddress: address,
                  }))
                }
                lookupAddress={fetchAddressByCEP}
                required
                disabled={m.isSubmitting}
              />
              {m.isCalculatingFreight ? (
                <ActivityIndicator accessibilityLabel="Calculando frete" />
              ) : (
                m.freightOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={
                      m.selectedFreight === option.id ? 'default' : 'outline'
                    }
                    onClick={() => m.setSelectedFreight(option.id)}
                  >
                    {option.name} — {formatCurrency(option.price)}
                  </Button>
                ))
              )}
            </>
          ) : null}
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.md }}>
          <Text style={heading}>Resumo</Text>
          <Text style={text}>
            Subtotal:{' '}
            {formatCurrency(
              m.selectedEquipments.reduce(
                (sum, item) => sum + m.calculateSubtotal(item),
                0
              )
            )}
          </Text>
          <Text style={heading}>
            Total: {formatCurrency(m.calculateTotal())}
          </Text>
          {/* Termos da própria locadora (onda 134; D-C, parte 1): aceite só com os Termos publicados. */}
          {m.termos.exigeAceite ? (
            <>
              <View style={row}>
                <Checkbox
                  aria-label="Aceito os Termos de Uso"
                  checked={m.hasAcceptedTerms}
                  onCheckedChange={(value) =>
                    m.setHasAcceptedTerms(value === true)
                  }
                  disabled={m.isSubmitting}
                />
                <Text style={text}>Li e aceito os Termos de Uso</Text>
              </View>
              <Button variant="outline" onClick={() => setTermsOpen(true)}>
                Ler Termos de Uso
              </Button>
            </>
          ) : null}
          {m.termos.bloqueio ? (
            <Text accessibilityRole="alert" style={text}>
              {m.termos.bloqueio}
            </Text>
          ) : null}
          <Button
            disabled={m.isSubmitting}
            onClick={() => void m.handleSubmit({ preventDefault() {} })}
          >
            {m.isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
          </Button>
        </View>
      </Card>
      <Confirmation
        open={termsOpen}
        title="Termos de Uso"
        onClose={() => setTermsOpen(false)}
      >
        <View style={{ gap: space.md }}>
          {m.termos.documento ? (
            <Text style={muted}>
              Atualizado em {m.termos.documento.lastUpdated}
            </Text>
          ) : null}
          {(m.termos.documento?.sections ?? []).map((section) => (
            <View key={section.id} style={{ gap: space.sm }}>
              <Text style={heading}>{section.title}</Text>
              {section.blocks.map((block, i) =>
                block.type === 'paragraph' ? (
                  <Text key={i} style={text}>
                    {block.text}
                  </Text>
                ) : (
                  <View key={i} style={{ gap: space.xs }}>
                    {block.items.map((item, j) => {
                      const { lead, text: resto } =
                        storefrontLegalItemParts(item)
                      return (
                        <Text key={j} style={text}>
                          • {lead === null ? resto : `${lead}${resto}`}
                        </Text>
                      )
                    })}
                  </View>
                )
              )}
            </View>
          ))}
        </View>
      </Confirmation>
      <Confirmation
        open={m.pendingWeekendConfirmation !== null}
        title="Incluir finais de semana?"
        onClose={m.handleWeekendConfirmationCancel}
      >
        <View style={{ gap: space.md }}>
          <Text style={text}>
            {m.pendingWeekendConfirmation?.equipmentName}: deseja incluir
            sábados e domingos na contagem?
          </Text>
          <Button onClick={() => void m.handleWeekendConfirmation(true)}>
            Sim, incluir finais de semana
          </Button>
          <Button
            variant="outline"
            onClick={() => void m.handleWeekendConfirmation(false)}
          >
            Não, apenas dias úteis
          </Button>
        </View>
      </Confirmation>
      <Confirmation
        open={m.saveAddressDialogOpen}
        title="Salvar endereço e informações?"
        onClose={() => m.setSaveAddressDialogOpen(false)}
      >
        <View style={{ gap: space.md }}>
          <Text style={text}>
            {formAddress.logradouro}, {formAddress.numero} —{' '}
            {formAddress.cidade}/{formAddress.estado}, {formAddress.cep}
          </Text>
          {Object.entries(customerInfo).map(([key, value]) => (
            <Text key={key} style={text}>
              {key}: {value}
            </Text>
          ))}
          <Button onClick={() => void m.handleSaveAddress()}>
            Salvar e enviar
          </Button>
          <Button variant="outline" onClick={m.handleSkipSaveAddress}>
            Enviar sem salvar endereço
          </Button>
        </View>
      </Confirmation>
      <Confirmation
        open={m.saveCustomerInfoDialogOpen}
        title="Salvar informações do cliente?"
        onClose={() => m.setSaveCustomerInfoDialogOpen(false)}
      >
        <View style={{ gap: space.md }}>
          {Object.entries(customerInfo).map(([key, value]) => (
            <Text key={key} style={text}>
              {key}: {value}
            </Text>
          ))}
          <Button onClick={() => void m.handleSaveCustomerInfo()}>
            Salvar informações e enviar
          </Button>
          <Button variant="outline" onClick={m.handleSkipSaveCustomerInfo}>
            Enviar sem salvar informações
          </Button>
        </View>
      </Confirmation>
      <Confirmation
        open={m.confirmAddressDialogOpen}
        title="Confirmar endereço salvo"
        onClose={m.handleCancelAddressDialog}
      >
        <View style={{ gap: space.md }}>
          <Text style={text}>
            {m.selectedSavedAddress?.street}, {m.selectedSavedAddress?.number} —{' '}
            {m.selectedSavedAddress?.city}/{m.selectedSavedAddress?.state}
          </Text>
          <Checkbox
            aria-label="Não perguntar novamente sobre este endereço"
            onCheckedChange={(v) => m.handleDismissConfirmation(v === true)}
          />
          <Button onClick={m.handleConfirmAddress}>
            Confirmar endereço e enviar
          </Button>
          <Button variant="outline" onClick={m.handleCancelAddressDialog}>
            Editar endereço
          </Button>
        </View>
      </Confirmation>
      <Confirmation
        open={m.selectAddressDialogOpen}
        title="Selecionar endereço salvo"
        onClose={m.handleCancelAddressDialog}
      >
        <View style={{ gap: space.md }}>
          {m.userAddresses.map((address) => (
            <Button
              key={address.id}
              variant="outline"
              onClick={() => m.handleSelectAddress(address.id)}
            >
              {address.street}, {address.number} — {address.city}/
              {address.state}
            </Button>
          ))}
          <Button variant="outline" onClick={m.handleUseOtherAddress}>
            Usar outro endereço
          </Button>
        </View>
      </Confirmation>
    </ScrollView>
  )
}
