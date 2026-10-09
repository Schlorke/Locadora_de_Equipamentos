import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

import { rentalStatusLabels } from './contracts'

export const statusConfig: Record<
  string,
  {
    label: string
    color: string
    icon: React.ComponentType<{ className?: string }>
    gradient: string
  }
> = {
  PENDING: {
    label: rentalStatusLabels.PENDING,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: Clock,
    gradient: 'from-orange-400 to-orange-500',
  },
  ACTIVE: {
    label: rentalStatusLabels.ACTIVE,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: CheckCircle,
    gradient: 'from-blue-400 to-cyan-500',
  },
  COMPLETED: {
    label: rentalStatusLabels.COMPLETED,
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
    gradient: 'from-green-400 to-emerald-500',
  },
  CANCELLED: {
    label: rentalStatusLabels.CANCELLED,
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
    gradient: 'from-red-400 to-rose-500',
  },
  OVERDUE: {
    label: rentalStatusLabels.OVERDUE,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertTriangle,
    gradient: 'from-yellow-400 to-orange-300',
  },
  PENDING_RETURN: {
    label: rentalStatusLabels.PENDING_RETURN,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: Clock,
    gradient: 'from-purple-400 to-pink-500',
  },
}
