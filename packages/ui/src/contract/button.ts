import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import {
  border,
  componentTokens,
  radius,
  space,
  typography,
  type ThemeColors,
} from '@gb-locacoes/design-tokens'

export const buttonVariantNames = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'ghost-white',
  'reset',
  'filter-reset',
  'header-action',
  'gradient',
  'link',
] as const
export type ButtonVariant = (typeof buttonVariantNames)[number]
export type ButtonSize = 'compact' | 'default' | 'sm' | 'lg' | 'icon'

/** Contrato compartilhado. O web aceita também atributos de button; o nativo usa este recorte. */
export interface ButtonProps {
  children?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  className?: string
  asChild?: boolean
  onClick?: () => void
  testID?: string
  'aria-label'?: string
}

/** Texto laranja no hover (outline, ghost, ghost-white e ação do cabeçalho). */
const HOVER_TEXT_ORANGE = 'hover:text-orange-600'
/** Texto e ícone laranja 500 no hover (destructive e as variantes de reset). */
const HOVER_TEXT_ORANGE_LIGHT = 'hover:text-orange-500'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-slate-700 text-white border border-slate-700 shadow-md hover:bg-slate-600 hover:border-slate-600 hover:scale-105 hover:shadow-lg transition-all duration-200',
        destructive: `bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:scale-105 hover:shadow-lg ${HOVER_TEXT_ORANGE_LIGHT} group transition-all duration-200`,
        outline: `border border-gray-200 bg-background shadow-md ${HOVER_TEXT_ORANGE} hover:scale-105 hover:shadow-lg transition-all duration-200`,
        secondary:
          'bg-secondary text-secondary-foreground shadow-md hover:bg-secondary/80 hover:scale-105 hover:shadow-lg transition-all duration-200',
        ghost: `border border-transparent ${HOVER_TEXT_ORANGE} hover:scale-105 transition-all duration-200`,
        'ghost-white': `border border-transparent hover:bg-white ${HOVER_TEXT_ORANGE} hover:scale-105 transition-[background-color,color,transform] duration-200 ease-in-out`,
        // Reset (restaurar configurações): no hover, texto/ícone laranja e sombra maior; nunca borda laranja nem escala.
        reset: `border border-gray-300 shadow-md ${HOVER_TEXT_ORANGE_LIGHT} hover:shadow-lg group transition-all duration-200`,
        // Reset de filtro, como o usuário pediu: no hover, texto/ícone laranja e sombra maior; nunca borda laranja nem
        // escala (Button.reset.web.test.tsx). A sombra também cresce no foco.
        'filter-reset': `border border-field shadow-control ${HOVER_TEXT_ORANGE_LIGHT} hover-always:shadow-raised-lg focus:shadow-raised-lg group transition-all duration-200`,
        // Ação do cabeçalho público (busca, conta, carrinho): sem borda nem sombra em repouso; sombra elevada no hover,
        // com o popover ou o menu aberto e na página atual (data-active).
        'header-action': `border-none ${HOVER_TEXT_ORANGE} hover:scale-105 hover-always:shadow-raised aria-expanded:shadow-raised data-[state=open]:shadow-raised data-active:shadow-raised transition-all duration-200`,
        gradient:
          'text-white border border-transparent shadow-md hover:scale-105 hover:shadow-lg transition-all duration-200',
        link: 'text-primary underline-offset-4 hover:underline transition-colors duration-200',
      },
      size: {
        compact: 'h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm',
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-10 rounded-md px-4 text-sm',
        lg: 'h-12 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonStyle {
  backgroundColor: string
  color: string
  borderColor: string
  borderWidth: number
  opacity: number
  paddingVertical: number
  paddingHorizontal: number
  borderRadius: number
  fontSize: number
  fontWeight: '400' | '600'
}

/** Estilo nativo derivado dos tokens. As classes Tailwind do web permanecem as da produção. */
export function resolveButtonStyle(
  theme: ThemeColors,
  variant: ButtonVariant,
  state: { disabled?: boolean }
): ButtonStyle {
  const button = componentTokens(theme).button
  const filled =
    variant === 'default' ||
    variant === 'gradient' ||
    variant === 'destructive' ||
    variant === 'secondary'
  const backgroundColor =
    variant === 'destructive'
      ? theme.danger
      : variant === 'gradient'
        ? button.background.primary
        : variant === 'default' || variant === 'secondary'
          ? button.background.secondary
          : 'transparent'
  const color = filled ? button.color.primary : theme.text
  return {
    backgroundColor,
    color,
    borderColor:
      variant === 'outline' || variant === 'reset'
        ? button.border.secondary
        : backgroundColor,
    borderWidth:
      variant === 'ghost' || variant === 'ghost-white' || variant === 'link'
        ? border.none
        : border.hairline,
    opacity: state.disabled ? 0.5 : 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  }
}
