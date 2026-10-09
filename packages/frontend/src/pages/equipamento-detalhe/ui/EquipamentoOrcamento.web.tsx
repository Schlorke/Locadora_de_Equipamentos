'use client'
import { useEquipmentQuote } from '../model/use-equipment-quote'
import type { SmartQuoteButtonProps } from '../model/pricing-contract'
export type { PricingOption } from '../model/pricing-contract'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogHeaderIcon,
  AlertDialogTitle,
  Button,
  CloseButton,
} from '../../../shared/ui'
import { toast } from 'sonner'
import { avisoLogin } from '../model/avisos'
import { useVisiblePathname } from '../../../shared/lib/navigation/use-visible-pathname.web'
import { useRouter } from 'next/navigation'

const notifyLogin = () =>
  toast.info(avisoLogin.message, {
    description: avisoLogin.description,
    position: avisoLogin.position,
    duration: avisoLogin.duration,
  })

export function SmartQuoteButton({
  equipmentId,
  equipmentName,
  pricePerDay,
  isAvailable,
  selectedPeriod,
  finalPrice,
  maxStock,
  description,
  category,
  images,
  dailyDiscount,
  weeklyDiscount,
  biweeklyDiscount,
  monthlyDiscount,
  dailyDirectValue,
  weeklyDirectValue,
  biweeklyDirectValue,
  monthlyDirectValue,
  dailyUseDirectValue,
  weeklyUseDirectValue,
  biweeklyUseDirectValue,
  monthlyUseDirectValue,
  startDate,
  endDate,
  selectedDays,
  includeWeekends = false,
  weekendSelectionConfirmed = false,
  onWeekendSelectionConfirm,
  className,
  size = 'lg',
  variant = 'default',
  children = 'Solicitar Orçamento Grátis',
}: SmartQuoteButtonProps) {
  const router = useRouter()
  const pathname = useVisiblePathname()
  const query =
    typeof window !== 'undefined' && window.location.pathname === pathname
      ? window.location.search
      : ''

  const {
    isWeekendDialogOpen,
    pendingQuoteRequest,
    handleQuoteRequest,
    handleWeekendConfirmation,
    handleWeekendCancel,
  } = useEquipmentQuote(
    {
      equipmentId,
      equipmentName,
      pricePerDay,
      isAvailable,
      selectedPeriod,
      finalPrice,
      maxStock,
      description,
      category,
      images,
      dailyDiscount,
      weeklyDiscount,
      biweeklyDiscount,
      monthlyDiscount,
      dailyDirectValue,
      weeklyDirectValue,
      biweeklyDirectValue,
      monthlyDirectValue,
      dailyUseDirectValue,
      weeklyUseDirectValue,
      biweeklyUseDirectValue,
      monthlyUseDirectValue,
      startDate,
      endDate,
      selectedDays,
      includeWeekends,
      weekendSelectionConfirmed,
      onWeekendSelectionConfirm,
      className,
      size,
      variant,
      children,
    },
    { router, pathname, query, notifyLogin }
  )

  if (!isAvailable) {
    return (
      <Button size={size} variant={variant} className={className} disabled>
        Equipamento Indisponível
      </Button>
    )
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        onClick={handleQuoteRequest}
        aria-busy={pendingQuoteRequest || undefined}
      >
        {children}
      </Button>

      <AlertDialog
        open={isWeekendDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleWeekendCancel()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader className="relative pr-8">
            <CloseButton
              size="sm"
              variant="ghostWhite"
              className="absolute right-4 top-4"
              onClick={handleWeekendCancel}
              aria-label="Fechar dialog"
            />
            <AlertDialogHeaderIcon />
            <AlertDialogTitle>Incluir finais de semana?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="p-4 md:p-6">
            <AlertDialogDescription>
              Você está solicitando locação de <strong>{equipmentName}</strong>{' '}
              sem ter selecionado datas específicas no calendário.
              <br />
              <br />
              <strong>
                Deseja incluir os finais de semana na contagem de dias?
              </strong>
              <br />
              <br />
              <span className="text-sm text-muted-foreground">
                • <strong>Sim:</strong> Sábados e domingos serão contados como
                dias de locação
                <br />• <strong>Não:</strong> Apenas dias úteis (segunda a
                sexta) serão contados
              </span>
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleWeekendConfirmation(false)}>
              Não, apenas dias úteis
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleWeekendConfirmation(true)}>
              Sim, incluir finais de semana
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
