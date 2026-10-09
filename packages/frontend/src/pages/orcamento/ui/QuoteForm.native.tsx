import { Text, View } from 'react-native'
import { Button, Card, Input, Textarea, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useQuoteForm,
  type QuoteFormData,
  type QuoteFormProps,
} from '../model/use-quote-form'
import { useQuotePageScope } from '../model/use-quote-page'
import { useWhatsAppNoClique } from '../model/whatsapp-da-locadora'

export default function QuoteForm(props: QuoteFormProps) {
  return <FormContent key={useQuotePageScope()} {...props} />
}
function FormContent(props: QuoteFormProps) {
  // App: o WhatsApp é lido no clique e aberto pelo Linking (sem bloqueador de pop-ups).
  const m = useQuoteForm(props, useWhatsAppNoClique()),
    theme = useTheme()
  const text = { color: theme.text }
  const field = (key: keyof QuoteFormData, label: string, type?: string) => (
    <View key={key} style={{ gap: space.xs }}>
      <Text style={text}>{label}</Text>
      <Input
        aria-label={label}
        type={type}
        value={String(m.watchedData[key] ?? '')}
        aria-invalid={Boolean(m.errors[key])}
        onChangeText={(value) =>
          m.setValue(
            key,
            key === 'rentalDays'
              ? Number(value)
              : key === 'cpf'
                ? m.formatCPF(value)
                : key === 'cnpj'
                  ? m.formatCNPJ(value)
                  : key === 'cep'
                    ? m.formatCEP(value)
                    : value,
            { shouldValidate: true }
          )
        }
      />
      {m.errors[key]?.message ? (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {m.errors[key]?.message}
        </Text>
      ) : null}
    </View>
  )
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <Text
          accessibilityRole="header"
          style={{
            ...text,
            fontSize: typography.size.lg,
            fontWeight: typography.weight.bold,
          }}
        >
          Solicitar Orçamento
        </Text>
        <Text style={text}>
          Etapa {m.currentStep} de {m.totalSteps}:{' '}
          {m.stepTitles[m.currentStep - 1]}
        </Text>
        {m.currentStep === 1 ? (
          <>
            {field('customerName', 'Nome Completo')}
            {field('customerEmail', 'E-mail', 'email')}
            {field('customerPhone', 'Telefone')}
            {field('customerCompany', 'Empresa')}
            {field('cpf', 'CPF')}
            {field('cnpj', 'CNPJ')}
            {field('cep', 'CEP')}
          </>
        ) : null}
        {m.currentStep === 2 ? (
          <>
            {field('equipmentName', 'Equipamento')}
            {field('rentalDays', 'Dias de locação', 'number')}
          </>
        ) : null}
        {m.currentStep === 3 ? (
          <>
            <Text style={text}>Observações</Text>
            <Textarea
              value={m.watchedData.message ?? ''}
              onChangeText={(value) => m.setValue('message', value)}
            />
            <Text style={text}>Urgência</Text>
            {(['baixa', 'media', 'alta'] as const).map((value) => (
              <Button
                key={value}
                variant={
                  m.watchedData.urgency === value ? 'default' : 'outline'
                }
                onClick={() => m.setValue('urgency', value)}
              >
                {value}
              </Button>
            ))}
          </>
        ) : null}
        <View style={{ gap: space.sm }}>
          {m.currentStep > 1 ? (
            <Button variant="outline" onClick={m.previousStep}>
              Anterior
            </Button>
          ) : null}
          {m.currentStep < m.totalSteps ? (
            <Button onClick={() => void m.nextStep()}>Próximo</Button>
          ) : (
            <>
              <Button onClick={() => void m.handleSubmit(m.onSubmit)()}>
                Enviar Solicitação
              </Button>
              <Button variant="outline" onClick={m.handleWhatsAppSubmit}>
                Enviar pelo WhatsApp
              </Button>
            </>
          )}
          {props.onCancel ? (
            <Button variant="outline" onClick={props.onCancel}>
              Cancelar
            </Button>
          ) : null}
        </View>
      </View>
    </Card>
  )
}
