import { Calendar, Truck, CheckCircle, XCircle } from 'lucide-react'
import { statusLabels } from './contracts'

export const statusConfig: Record<
  string,
  {
    label: string
    color: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  SCHEDULED: {
    label: statusLabels.SCHEDULED!.label,
    color:
      'bg-[var(--status-info-surface)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
    icon: Calendar,
  },
  IN_TRANSIT: {
    label: statusLabels.IN_TRANSIT!.label,
    color:
      'bg-[var(--status-warning-surface)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
    icon: Truck,
  },
  COMPLETED: {
    label: statusLabels.COMPLETED!.label,
    color:
      'bg-[var(--status-success-surface)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
    icon: CheckCircle,
  },
  CANCELLED: {
    label: statusLabels.CANCELLED!.label,
    color:
      'bg-[var(--status-danger-surface)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
    icon: XCircle,
  },
  FAILED: {
    label: statusLabels.FAILED!.label,
    color:
      'bg-[var(--status-danger-surface)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
    icon: XCircle,
  },
}
