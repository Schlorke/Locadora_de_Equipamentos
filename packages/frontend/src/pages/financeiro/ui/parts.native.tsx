import type { ReactNode } from 'react'
import { View, Text } from 'react-native'
import { Button, Input, Dialog, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
export function FinancialSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const theme = useTheme()
  return (
    <View style={{ gap: space.sm, paddingVertical: space.sm }}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.lg,
          fontWeight: typography.weight.bold,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}
export function FinancialText({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return <Text style={{ color: theme.text }}>{children}</Text>
}
export function FinancialField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  onChange(value: string): void
  disabled?: boolean
}) {
  return (
    <View style={{ gap: space.xs }}>
      <FinancialText>{label}</FinancialText>
      <Input
        aria-label={label}
        value={value}
        onChangeText={onChange}
        disabled={disabled}
      />
    </View>
  )
}
export function FinancialChoices<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T
  options: ReadonlyArray<readonly [T, string, boolean?]>
  onChange(value: T): void
  disabled?: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map(([key, label, blocked = false]) => (
        <Button
          key={key}
          disabled={disabled || blocked}
          variant={key === value ? 'default' : 'outline'}
          onClick={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </View>
  )
}
export function FinancialDialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose(): void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Portal>
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  <View style={{ gap: space.md }}>{children}</View>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            {footer ? <Dialog.Footer>{footer}</Dialog.Footer> : null}
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function FinancialConfirm({
  open,
  title,
  message,
  busy,
  onConfirm,
  close,
}: {
  open: boolean
  title: string
  message: string
  busy: boolean
  onConfirm(): void
  close(): void
}) {
  return (
    <FinancialDialog
      open={open}
      title={title}
      onClose={close}
      footer={
        <View style={{ gap: space.sm }}>
          <Button variant="outline" disabled={busy} onClick={close}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? 'Aguarde...' : 'Confirmar'}
          </Button>
        </View>
      }
    >
      <FinancialText>{message}</FinancialText>
    </FinancialDialog>
  )
}
