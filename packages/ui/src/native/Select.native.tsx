import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type ComponentRef,
} from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { border, radius, space } from '@gb-locacoes/design-tokens'
import { useTheme } from '../theme/ThemeProvider'
interface SelectContextValue {
  value?: string
  label?: ReactNode
  open: boolean
  setOpen: (open: boolean) => void
  select: (value: string) => void
  disabled?: boolean
  scroll: React.RefObject<ComponentRef<typeof ScrollView> | null>
}
const Context = createContext<SelectContextValue | null>(null)
const useSelect = () => {
  const value = useContext(Context)
  if (!value) throw new Error('Select components require Select')
  return value
}
interface ChildrenProps {
  children?: ReactNode
}
export function Select({
  children,
  value: controlled,
  defaultValue,
  onValueChange,
  disabled,
}: {
  children?: ReactNode
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}) {
  const [uncontrolled, setValue] = useState(defaultValue),
    [open, setOpen] = useState(false),
    scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const value = controlled ?? uncontrolled
  let label: ReactNode
  const find = (nodes: ReactNode) =>
    Children.forEach(nodes, (child) => {
      if (!isValidElement<{ value?: string; children?: ReactNode }>(child))
        return
      if (child.type === SelectItem && child.props.value === value)
        label = child.props.children
      find(child.props.children)
    })
  find(children)
  const select = (next: string) => {
    if (disabled) return
    if (controlled === undefined) setValue(next)
    onValueChange?.(next)
    setOpen(false)
  }
  return (
    <Context.Provider
      value={{ value, label, open, setOpen, select, disabled, scroll }}
    >
      {children}
    </Context.Provider>
  )
}
export function SelectTrigger({
  children,
  disabled,
  'aria-label': label,
}: {
  children?: ReactNode
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const select = useSelect(),
    theme = useTheme()
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="combobox"
      accessibilityState={{
        expanded: select.open,
        disabled: !!(disabled || select.disabled),
      }}
      disabled={disabled || select.disabled}
      onPress={() => select.setOpen(true)}
      style={{
        borderWidth: border.hairline,
        borderColor: theme.border,
        borderRadius: radius.sm,
        padding: space.sm,
      }}
    >
      {children}
    </Pressable>
  )
}
export function SelectValue({
  placeholder = 'Selecionar...',
}: {
  placeholder?: string
}) {
  const select = useSelect(),
    theme = useTheme()
  return (
    <Text style={{ color: theme.text }}>
      {select.label ?? select.value ?? placeholder}
    </Text>
  )
}
export function SelectContent({ children }: ChildrenProps) {
  const select = useSelect(),
    theme = useTheme()
  return (
    <Modal
      visible={select.open}
      transparent
      animationType="fade"
      onRequestClose={() => select.setOpen(false)}
    >
      <View style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
        <Pressable
          accessibilityLabel="Fechar opções"
          onPress={() => select.setOpen(false)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: theme.text,
            opacity: 0.25,
          }}
        />
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.md,
            padding: space.md,
            maxHeight: '80%',
          }}
        >
          <ScrollView ref={select.scroll}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  )
}
export function SelectItem({
  children,
  value,
  disabled,
}: {
  children?: ReactNode
  value: string
  disabled?: boolean
}) {
  const select = useSelect(),
    theme = useTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{
        selected: select.value === value,
        disabled: !!disabled,
      }}
      disabled={disabled}
      onPress={() => select.select(value)}
      style={{
        padding: space.md,
        backgroundColor:
          select.value === value ? theme.background : theme.surface,
        borderRadius: radius.sm,
      }}
    >
      <Text style={{ color: disabled ? theme.textMuted : theme.text }}>
        {children}
      </Text>
    </Pressable>
  )
}
export function SelectGroup({ children }: ChildrenProps) {
  return <View>{children}</View>
}
export function SelectLabel({ children }: ChildrenProps) {
  const theme = useTheme()
  return (
    <Text style={{ color: theme.textMuted, padding: space.sm }}>
      {children}
    </Text>
  )
}
export function SelectSeparator() {
  const theme = useTheme()
  return (
    <View style={{ height: border.hairline, backgroundColor: theme.border }} />
  )
}
export function SelectScrollDownButton() {
  const select = useSelect()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Últimas opções"
      onPress={() => select.scroll.current?.scrollToEnd()}
    >
      <Text>↓</Text>
    </Pressable>
  )
}
export function SelectScrollUpButton() {
  const select = useSelect()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Primeiras opções"
      onPress={() => select.scroll.current?.scrollTo({ y: 0 })}
    >
      <Text>↑</Text>
    </Pressable>
  )
}
