'use client'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { forwardRef } from 'react'
import * as React from 'react'
import { X } from 'lucide-react'
import { MENU_FOCUS_RING, trackInputModality } from './focus-ring'
import { TRIGGER_FRAME } from './trigger'

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// O X recebe o foco inicial por código ao abrir: o anel segue a modalidade de entrada registrada no <html>.
trackInputModality()

const BACKDROP_BASE_CLASSES =
  'fixed inset-0 z-[var(--layer-dialog-backdrop)] min-h-dvh bg-black/60 overscroll-none touch-none transition-all duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 dark:bg-black/70'

/**
 * Nested dialogs: -data-[nested-parent]:translate-y-[0.85rem] aplica translate-y e scale quando a dialog
 * pai tem uma filha aberta (ex: composer sobre visualização de email). Isso reduz
 * a dialog pai para dar destaque à nova. NÃO REMOVER nem alterar essas classes.
 * @see docs/features/dialog-lab.md e .cursor/skills/dialogs-implementation/SKILL.md
 */
const POPUP_CLASS_VARIANTS = {
  default:
    'fixed left-1/2 top-[calc(50%+1rem*var(--nested-dialogs))] z-[var(--layer-dialog)] w-[calc(100vw-0.8rem)] max-w-lg h-[80vh] max-h-[80vh] md:h-[71vh] md:max-h-[71vh] -translate-x-1/2 -translate-y-1/2 scale-[calc(1-0.1*var(--nested-dialogs))] flex flex-col rounded-2xl bg-white p-0 text-slate-900 shadow-2xl transition-all duration-200 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[nested-dialog-open]:after:absolute data-[nested-dialog-open]:after:inset-0 data-[nested-dialog-open]:after:rounded-[inherit] data-[nested-dialog-open]:after:bg-black/5 -data-[nested-parent]:translate-y-[0.85rem] data-[nested-parent]:scale-[0.985]',
  compact:
    'fixed top-[calc(50%+1.25rem*var(--nested-dialogs))] left-1/2 z-[var(--layer-dialog)] -mt-8 w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 scale-[calc(1-0.1*var(--nested-dialogs))] rounded-lg bg-gray-50 p-4 md:p-6 text-gray-900 outline outline-1 outline-gray-200 transition-all duration-150 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[nested-dialog-open]:after:absolute data-[nested-dialog-open]:after:inset-0 data-[nested-dialog-open]:after:rounded-[inherit] data-[nested-dialog-open]:after:bg-black/5 dark:outline-gray-300',
} as const

const CONTENT_BASE_CLASSES = 'flex h-full flex-col'
const HEADER_BASE_CLASSES =
  'relative flex shrink-0 items-center gap-3 p-4 md:p-6 border-b border-gray-100 rounded-t-2xl bg-gradient-to-r from-slate-50 to-slate-100'
const HEADER_ICON_BASE_CLASSES =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-sm'
/**
 * X do cabeçalho. O diálogo move o foco inicial para ele por código, e o Chromium trata esse foco como :focus-visible
 * mesmo com o diálogo aberto por clique: o anel só vale com a modalidade de teclado (MENU_FOCUS_RING), como nos menus.
 */
const CLOSE_BUTTON_BASE_CLASSES =
  `absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-lg disabled:pointer-events-none disabled:opacity-50 transition-all duration-300 text-slate-400 hover:text-slate-600 hover:bg-white ${MENU_FOCUS_RING} [&>svg]:h-4 [&>svg]:w-4`
const BODY_BASE_CLASSES = 'flex-1 min-h-0'
const BODY_VIEWPORT_BASE_CLASSES =
  'h-full w-full overflow-y-auto overflow-x-hidden'
const BODY_CONTENT_BASE_CLASSES =
  'p-4 md:p-6 space-y-6 pb-2 xs:px-5 xs:py-3 xs:space-y-3 w-full max-w-full overflow-visible'
const FOOTER_BASE_CLASSES =
  'p-4 md:p-6 border-t bg-gray-50 rounded-b-2xl shrink-0 w-full max-w-full xs:p-3'

type DialogPopupVariant = keyof typeof POPUP_CLASS_VARIANTS | 'unstyled'

const DialogRoot = BaseDialog.Root
const DialogTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Trigger>
>(({ className, ...props }, ref) => (
  <BaseDialog.Trigger
    ref={ref}
    className={
      typeof className === 'function'
        ? (state) => cn(TRIGGER_FRAME, className(state))
        : cn(TRIGGER_FRAME, className)
    }
    {...props}
  />
))
DialogTrigger.displayName = 'DialogTrigger'
const DialogPortal = BaseDialog.Portal
const DialogClose = BaseDialog.Close
const DialogTitle = BaseDialog.Title
const DialogDescription = BaseDialog.Description

const DialogBackdrop = forwardRef<
  React.ElementRef<typeof BaseDialog.Backdrop>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn(BACKDROP_BASE_CLASSES, className)}
    onWheel={(e) => {
      // Prevenir scroll no backdrop
      e.preventDefault()
      e.stopPropagation()
    }}
    onTouchMove={(e) => {
      // Prevenir scroll touch no backdrop
      e.preventDefault()
      e.stopPropagation()
    }}
    {...props}
  />
))
DialogBackdrop.displayName = 'DialogBackdrop'

interface DialogPopupProps extends React.ComponentPropsWithoutRef<
  typeof BaseDialog.Popup
> {
  variant?: DialogPopupVariant
}

const DialogPopup = forwardRef<
  React.ElementRef<typeof BaseDialog.Popup>,
  DialogPopupProps
>(({ className, variant = 'default', ...props }, ref) => {
  const variantClasses =
    variant === 'unstyled'
      ? null
      : (POPUP_CLASS_VARIANTS[variant] ?? POPUP_CLASS_VARIANTS.default)

  return (
    <BaseDialog.Popup
      ref={ref}
      className={cn(variantClasses, className)}
      {...props}
    />
  )
})
DialogPopup.displayName = 'DialogPopup'

const DialogContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(CONTENT_BASE_CLASSES, className)} {...props} />
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(HEADER_BASE_CLASSES, className)} {...props} />
))
DialogHeader.displayName = 'DialogHeader'

const DialogHeaderIcon = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(HEADER_ICON_BASE_CLASSES, className)}
    {...props}
  />
))
DialogHeaderIcon.displayName = 'DialogHeaderIcon'

const DialogCloseButton = forwardRef<
  React.ElementRef<typeof BaseDialog.Close>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Close>
>(({ className, children, ...props }, ref) => (
  <BaseDialog.Close
    ref={ref}
    className={cn(CLOSE_BUTTON_BASE_CLASSES, className)}
    {...props}
  >
    {children ?? <X />}
  </BaseDialog.Close>
))
DialogCloseButton.displayName = 'DialogCloseButton'

const DialogBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(BODY_BASE_CLASSES, className)} {...props} />
))
DialogBody.displayName = 'DialogBody'

const DialogBodyViewport = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const combinedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

  React.useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleWheel = (e: WheelEvent) => {
      // Não interferir com scroll de textarea/input/contenteditable – deixa o nativo rolar.
      // e.target pode ser Text (ex.: dentro de textarea) – usar parentNode para subir até um Element.
      const target = e.target
      let el: Element | null = target instanceof Element ? target : null
      if (!el && target && typeof (target as Node).parentNode !== 'undefined') {
        let node: Node | null = (target as Node).parentNode
        while (node && !(node instanceof Element)) node = node.parentNode
        el = node instanceof Element ? node : null
      }
      const isScrollableFormControl =
        el &&
        (el instanceof HTMLTextAreaElement ||
          el instanceof HTMLInputElement ||
          el.closest('textarea, input, [contenteditable="true"]'))
      if (isScrollableFormControl) return

      const { scrollTop, scrollHeight, clientHeight } = viewport
      const isAtTop = scrollTop === 0
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1

      // Se estiver no topo e tentar rolar para cima, prevenir
      if (isAtTop && e.deltaY < 0) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // Se estiver no bottom e tentar rolar para baixo, prevenir
      if (isAtBottom && e.deltaY > 0) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      viewport.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <div
      ref={combinedRef}
      className={cn(BODY_VIEWPORT_BASE_CLASSES, className)}
      style={{ overscrollBehavior: 'contain' }}
      {...props}
    />
  )
})
DialogBodyViewport.displayName = 'DialogBodyViewport'

const DialogBodyContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(BODY_CONTENT_BASE_CLASSES, className)}
    {...props}
  />
))
DialogBodyContent.displayName = 'DialogBodyContent'

const DialogFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(FOOTER_BASE_CLASSES, className)} {...props} />
))
DialogFooter.displayName = 'DialogFooter'

export const dialogStyles = {
  backdrop: BACKDROP_BASE_CLASSES,
  popup: POPUP_CLASS_VARIANTS,
  content: CONTENT_BASE_CLASSES,
  header: HEADER_BASE_CLASSES,
  headerIcon: HEADER_ICON_BASE_CLASSES,
  closeButton: CLOSE_BUTTON_BASE_CLASSES,
  body: BODY_BASE_CLASSES,
  bodyViewport: BODY_VIEWPORT_BASE_CLASSES,
  bodyContent: BODY_CONTENT_BASE_CLASSES,
  footer: FOOTER_BASE_CLASSES,
} as const

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Backdrop: DialogBackdrop,
  Popup: DialogPopup,
  Close: DialogClose,
  CloseButton: DialogCloseButton,
  Title: DialogTitle,
  Description: DialogDescription,
  Content: DialogContent,
  Header: DialogHeader,
  HeaderIcon: DialogHeaderIcon,
  Body: DialogBody,
  BodyViewport: DialogBodyViewport,
  BodyContent: DialogBodyContent,
  Footer: DialogFooter,
}

export type { DialogPopupProps, DialogPopupVariant }
