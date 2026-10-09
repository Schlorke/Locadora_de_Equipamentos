import { Badge } from '@gb-locacoes/ui'
import { statusConfig } from '../model/tipos.web'

export { formatDate, formatAddress } from '../model/display'

export function getStatusBadge(status: string) {
  const config = statusConfig[status] || statusConfig.SCHEDULED
  if (!config) return null
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={`${config.color} items-center gap-1.5 font-medium w-fit`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </Badge>
  )
}
