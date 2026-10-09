export interface RentalActionsProps {
  rentalId: string
  status: string
  endDate: Date
  hasBoleto?: boolean
  boletoPaymentId?: string
  className?: string
}
