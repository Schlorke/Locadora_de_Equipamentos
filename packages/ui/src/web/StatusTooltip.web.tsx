'use client'

import { CircleHelp } from 'lucide-react'

import { HybridTooltip } from './HybridTooltip.web'
import { getStatusDefinition } from '../status-definitions'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Badge } from './Badge.web'

interface StatusTooltipProps {
  status: string
  className?: string
  label?: string
}

export function StatusTooltip({
  status,
  className,
  label,
}: StatusTooltipProps) {
  const definition = getStatusDefinition(status)
  const displayLabel = label || definition?.label || status
  const hasCustomSolidStyle = className?.includes('bg-')
  const badgeVariant = hasCustomSolidStyle ? 'custom' : 'outline'

  if (!definition) {
    return (
      <Badge variant={badgeVariant} className={className}>
        {displayLabel}
      </Badge>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Badge variant={badgeVariant} className={cn('font-medium', className)}>
        {displayLabel}
      </Badge>
      <HybridTooltip
        content={definition.description}
        side="top"
        delayDuration={120}
      >
        <CircleHelp className="h-3.5 w-3.5 text-slate-500 hover:text-slate-700 cursor-help transition-colors" />
      </HybridTooltip>
    </div>
  )
}
