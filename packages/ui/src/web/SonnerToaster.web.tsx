'use client'

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { FOCUS_RING } from './focus-ring'

/**
 * Toaster component seguindo 100% os padrões oficiais da biblioteca Sonner.
 * Implementação conforme documentação oficial shadcn/ui (atualizada 13/10/2025).
 *
 * O Sonner injeta o próprio CSS fora de camada, que vence classes; em vez de forçar prioridade:
 * - distância do topo: as props `offset`/`mobileOffset` apontam para `--toaster-top`, definido abaixo por contexto
 *   (site público ou painel com `body.admin-body-layout`);
 * - altura natural das toasts com `expand={false}`: `toastOptions.style` (estilo inline no <li>);
 * - transição dos botões de ação: `actionButtonStyle`/`cancelButtonStyle` (estilo inline);
 * - cores por tipo: cada tipo (`success`, `error`…) recebe só as próprias classes (`classNames[tipo]`), sem disputa
 *   com as classes do tipo `default`;
 * - transição de cor do botão de fechar: ele é filho direto do toast, onde o Sonner fixa `transition: opacity 400ms`,
 *   e não aceita `style`; a regra no <style> abaixo (também fora de camada, mais específica) põe a transição.
 *
 * ESTILIZAÇÃO DE BOTÕES POR TIPO DE TOAST: use seletores descendentes do Tailwind no tipo, ex.
 * `[&_button[data-close-button]:hover]:bg-gray-100` (cada tipo pode ter cores diferentes para os mesmos elementos).
 *
 * @see https://sonner.emilkowal.ski/getting-started
 * @see https://github.com/emilkowalski/sonner
 * @see https://ui.shadcn.com/docs/components/sonner
 */

/** Transição `transition-all` do Tailwind, inline: o CSS do Sonner (`[data-sonner-toast] > *`) vence classes. */
const BUTTON_TRANSITION = {
  transitionProperty: 'all',
  transitionTimingFunction: 'var(--default-transition-timing-function)',
  transitionDuration: 'var(--default-transition-duration)',
} as const

export function Toaster(props: ToasterProps) {
  return (
    <>
      {/* Distância do topo do toaster: abaixo do header público (104px + 16px) ou do header do painel. */}
      <style>{`
        [data-sonner-toaster] {
          --toaster-top: 120px;
        }
        /* Admin: a classe é montada por AdminLayoutShell.web.tsx do frontend. */
        body.admin-body-layout [data-sonner-toaster] {
          --toaster-top: calc(64px + 16px);
        }
        /* Admin mobile: header do admin aparece (pt-16) */
        @media (max-width: 767px) {
          body.admin-body-layout [data-sonner-toaster] {
            --toaster-top: calc(
              64px + max(44px, env(safe-area-inset-top, 0px)) + 16px
            );
          }
        }
        /* Botão de fechar: transição de cores (transition-colors do Tailwind) no lugar do "opacity" do Sonner. */
        [data-sonner-toast] > [data-close-button] {
          transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill,
            stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to;
          transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
          transition-duration: var(--tw-duration, var(--default-transition-duration));
        }
      `}</style>

      <Sonner
        theme="light"
        className="toaster group"
        offset={{ top: 'var(--toaster-top)' }}
        mobileOffset={{ top: 'var(--toaster-top)' }}
        icons={{
          success: <CircleCheckIcon className=" size-5 text-green-700" />,
          info: <InfoIcon className="size-5 text-gray-700" />,
          warning: <TriangleAlertIcon className="size-5 text-orange-700" />,
          error: <OctagonXIcon className="size-5 text-red-700" />,
          loading: (
            <Loader2Icon className="size-5 animate-spin text-gray-700" />
          ),
        }}
        toastOptions={{
          unstyled: true,
          // Mantém a altura natural das toasts mesmo com expand={false}
          style: { height: 'auto' },
          actionButtonStyle: BUTTON_TRANSITION,
          cancelButtonStyle: BUTTON_TRANSITION,
          // Descrição ocupa 2 colunas (col-start-2 + col-span-2 = colunas 2 e 3)
          // Isso evita que a descrição fique comprimida pelos botões na linha 3
          // col-span-2: Expande a descrição para ocupar as colunas 2 e 3, ficando mais larga
          descriptionClassName:
            'col-start-2 col-span-2 row-start-2 text-sm block text-gray-500',
          classNames: {
            toast:
              'group/toast grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1 p-4 rounded-lg shadow-lg border w-full md:max-w-[364px]',
            default:
              'bg-white border border-border shadow-md hover:shadow-lg [&_[data-title]]:text-gray-900',
            success:
              'bg-green-50 border-green-100 [&_[data-title]]:text-green-700 [&_[data-description]]:text-green-600',
            error:
              'bg-red-50 border-red-100 [&_[data-title]]:text-red-700 [&_[data-description]]:text-red-600',
            warning:
              'bg-yellow-50 border-yellow-100 [&_[data-title]]:text-orange-700 [&_[data-description]]:text-orange-600',
            // Sintaxe para estilizar botões por tipo: [&_button[seletor]:hover]:classe
            // Permite cada tipo de toast ter cores diferentes para os mesmos botões
            info: 'bg-gray border-gray-100 [&_[data-title]]:text-gray-700 [&_[data-description]]:text-gray-600 [&_button[data-close-button]:hover]:bg-gray-100',
            loading:
              'bg-gray-40 border-gray-100 [&_[data-title]]:text-gray-700 [&_[data-description]]:text-gray-600',
            // O Sonner centraliza `.sonner-loader` com position:absolute; no toast de carregamento a célula do ícone
            // vira a referência (relative, do tamanho do ícone), e o carregador fica no mesmo lugar do ícone estático.
            icon: 'col-start-1 row-start-1 self-start group-data-[type=loading]/toast:relative group-data-[type=loading]/toast:size-5',
            loader:
              'col-start-1 row-start-1 self-start justify-self-center data-[visible=false]:hidden',
            content: 'contents',
            title:
              'col-start-2 row-start-1 font-semibold text-sm flex min-w-0 items-start',
            actionButton:
              'col-start-3 row-start-3 mt-4 inline-flex items-center justify-center gap-2  rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-orange-600 shadow-md hover:shadow-sm active:shadow-none active:text-gray-500',
            cancelButton:
              'col-start-2 row-start-3 mt-4 justify-self-end w-auto inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-orange-600 shadow-md hover:shadow-sm active:shadow-none active:text-gray-500',
            closeButton: `absolute top-2 right-2 rounded-md p-1 text-gray-500 hover:bg-white/90 ${FOCUS_RING}`,
          },
        }}
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
            '--border-radius': 'var(--radius)',
          } as React.CSSProperties
        }
        position="top-center"
        closeButton
        expand={false}
        duration={4000}
        visibleToasts={3}
        {...props}
      />
    </>
  )
}
