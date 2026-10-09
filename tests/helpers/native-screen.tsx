import { forwardRef, useEffect, type ReactNode } from 'react'

interface HostProps {
  children?: ReactNode
  accessibilityRole?: string
  role?: string
  accessibilityLabel?: string
  accessibilityState?: { disabled?: boolean; expanded?: boolean }
  testID?: string
  onPress?: () => void
  disabled?: boolean
  className?: string
}
export function createNativeHost(classes: string[]) {
  const role = (value?: string) => (value === 'header' ? 'heading' : value)
  const View = forwardRef<HTMLDivElement, HostProps>(function View(
    { children, className, role: r, accessibilityRole, testID },
    ref
  ) {
    if (className) classes.push(className)
    return (
      <div ref={ref} role={r ?? role(accessibilityRole)} data-testid={testID}>
        {children}
      </div>
    )
  })
  const Text = forwardRef<HTMLSpanElement, HostProps>(function Text(
    { children, accessibilityRole },
    ref
  ) {
    return (
      <span ref={ref} role={role(accessibilityRole)}>
        {children}
      </span>
    )
  })
  const Pressable = forwardRef<HTMLButtonElement, HostProps>(function Pressable(
    {
      children,
      onPress,
      disabled,
      accessibilityRole,
      accessibilityLabel,
      className,
      testID,
    },
    ref
  ) {
    if (className) classes.push(className)
    return (
      <button
        ref={ref}
        role={role(accessibilityRole)}
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={onPress}
        data-testid={testID}
      >
        {children}
      </button>
    )
  })
  function Modal({
    children,
    visible,
    onShow,
    onRequestClose,
  }: {
    children?: ReactNode
    visible: boolean
    onShow?: () => void
    onRequestClose?: () => void
  }) {
    useEffect(() => {
      if (visible) onShow?.()
    }, [visible, onShow])
    return visible ? (
      <div>
        <button aria-label="Hardware back" onClick={onRequestClose} />
        {children}
      </div>
    ) : null
  }
  return {
    View,
    Text,
    Pressable,
    Modal,
    ScrollView: View,
    ActivityIndicator: () => <span role="status">Carregando...</span>,
    useWindowDimensions: () => ({ width: 400, height: 800 }),
    findNodeHandle: () => 1,
    AccessibilityInfo: { setAccessibilityFocus: () => {} },
    Linking: { openURL: async () => {} },
    Image: ({
      source,
      accessibilityLabel,
    }: {
      source: { uri: string }
      accessibilityLabel?: string
    }) => <img src={source.uri} alt={accessibilityLabel} />,
    TextInput: ({
      value,
      onChangeText,
      accessibilityLabel,
      editable,
    }: {
      value?: string
      onChangeText?: (text: string) => void
      accessibilityLabel?: string
      editable?: boolean
    }) => (
      <input
        value={value}
        aria-label={accessibilityLabel}
        disabled={editable === false}
        onChange={(e) => onChangeText?.(e.target.value)}
      />
    ),
    AppState: {
      currentState: 'active',
      addEventListener: () => ({ remove: () => {} }),
    },
  }
}
/** Primitivas nativas reais; somente o host RN é simulado em DOM. */
export async function nativeUi() {
  const button = await import('../../packages/ui/src/native/Button.native')
  const card = await import('../../packages/ui/src/native/Card.native')
  const badge = await import('../../packages/ui/src/native/Badge.native')
  const link = await import('../../packages/ui/src/native/Link.native')
  const chart = await import('../../packages/ui/src/native/Chart.native')
  const dialog = await import('../../packages/ui/src/native/Dialog.native')
  const theme = await import('../../packages/ui/src/theme/ThemeProvider')
  const input = await import('../../packages/ui/src/native/Input.native')
  const navigation = await import('../../packages/ui/src/contract/navigation')
  return {
    ...button,
    ...card,
    ...badge,
    ...link,
    ...chart,
    ...dialog,
    ...theme,
    ...input,
    ...navigation,
  }
}
