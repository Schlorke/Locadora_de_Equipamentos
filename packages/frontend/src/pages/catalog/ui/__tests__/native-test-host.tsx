import {
  Children,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react'
import { vi } from 'vitest'
interface Props {
  children?: ReactNode
  role?: string
  accessibilityRole?: string
  accessibilityLabel?: string
  accessibilityLabelledBy?: string
  accessibilityState?: {
    checked?: boolean
    expanded?: boolean
    selected?: boolean
  }
  testID?: string
  nativeID?: string
  onPress?: () => void
  disabled?: boolean
  value?: string
  placeholder?: string
  editable?: boolean
  onChangeText?: (text: string) => void
  onLoad?: () => void
  onError?: () => void
  source?: { uri?: string }
  accessibilityValue?: { now: number }
  onAccessibilityAction?: (event: {
    nativeEvent: { actionName: string }
  }) => void
  visible?: boolean
  onShow?: () => void
  onRequestClose?: () => void
}
function assertTextWrapped(children: ReactNode) {
  if (
    Children.toArray(children).some(
      (child) => typeof child === 'string' || typeof child === 'number'
    )
  )
    throw new Error('Native text must be inside Text')
}
const node = () => ({
  tag: 1,
  focus: vi.fn(),
  scrollTo: vi.fn(),
  scrollToEnd: vi.fn(),
  measureInWindow: (
    callback: (x: number, y: number, w: number, h: number) => void
  ) => callback(0, 0, 400, 300),
})
export const View = forwardRef(function View(
  { children, role, testID }: Props,
  ref
) {
  const target = useRef(node())
  useImperativeHandle(ref, () => target.current)
  assertTextWrapped(children)
  return (
    <div role={role} data-testid={testID}>
      {children}
    </div>
  )
})
export const Text = forwardRef(function Text(
  { children, accessibilityRole, nativeID }: Props,
  ref
) {
  const target = useRef(node())
  useImperativeHandle(ref, () => target.current)
  return (
    <span
      id={nativeID}
      role={
        accessibilityRole === 'header'
          ? 'heading'
          : accessibilityRole === 'alert'
            ? 'alert'
            : undefined
      }
    >
      {children}
    </span>
  )
})
export const Pressable = forwardRef(function Pressable(
  {
    children,
    onPress,
    disabled,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
    accessibilityValue,
    onAccessibilityAction,
  }: Props,
  ref
) {
  const target = useRef(node())
  useImperativeHandle(ref, () => target.current)
  assertTextWrapped(children)
  return (
    <button
      ref={undefined}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-checked={accessibilityState?.checked}
      aria-expanded={accessibilityState?.expanded}
      aria-selected={accessibilityState?.selected}
      aria-valuenow={accessibilityValue?.now}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight')
          onAccessibilityAction?.({ nativeEvent: { actionName: 'increment' } })
      }}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  )
})
export const TextInput = forwardRef(function TextInput(
  {
    value,
    placeholder,
    onChangeText,
    editable,
    accessibilityLabel,
    accessibilityLabelledBy,
    nativeID,
  }: Props,
  ref
) {
  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      id={nativeID}
      aria-label={accessibilityLabel}
      aria-labelledby={accessibilityLabelledBy}
      value={value}
      placeholder={placeholder}
      disabled={editable === false}
      onChange={(event) => onChangeText?.(event.target.value)}
    />
  )
})
export function Image({ source, accessibilityLabel, onLoad, onError }: Props) {
  return (
    <img
      src={source?.uri}
      alt={accessibilityLabel}
      onLoad={onLoad}
      onError={onError}
    />
  )
}
export function Modal({ children, visible, onShow, onRequestClose }: Props) {
  useEffect(() => {
    if (visible) onShow?.()
  }, [visible])
  return visible ? (
    <div>
      <button aria-label="Hardware back" onClick={onRequestClose} />
      {children}
    </div>
  ) : null
}
export const ScrollView = View
export function ActivityIndicator() {
  return <span role="status">Carregando</span>
}
export const useWindowDimensions = () => ({ width: 400, height: 800 })
export const findNodeHandle = () => 1
export const AccessibilityInfo = {
  setAccessibilityFocus: vi.fn(),
  isReduceMotionEnabled: async () => true,
  addEventListener: () => ({ remove: vi.fn() }),
}
export const Linking = { openURL: vi.fn() }
export const Animated = {
  View,
  Value: class {
    constructor(public value: number) {}
  },
  timing: () => ({ start: vi.fn() }),
}
