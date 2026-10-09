import { StatusTooltip } from '@gb-locacoes/ui'
import { statusConfig } from '../model/tipos.web'

export { formatCurrency, formatDate } from '../model/formatters'

export function getStatusBadge(status: string) {
  const config = statusConfig[status] || statusConfig.PENDING
  if (!config) return null
  const Icon = config.icon

  return (
    <div className="inline-flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" />
      <StatusTooltip
        status={status}
        label={config.label}
        className={`${config.color} border-b-0`}
      />
    </div>
  )
}
