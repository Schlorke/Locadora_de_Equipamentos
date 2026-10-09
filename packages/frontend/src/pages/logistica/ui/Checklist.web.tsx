'use client'

import { Checkbox } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { CheckCircle, XCircle } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import {
  deliveryChecklistItems,
  pickupChecklistItems,
} from '../model/checklist'

interface DeliveryChecklistProps {
  checklist: Record<string, boolean | string | number> | null
  onChecklistChange: (
    _checklist: Record<string, boolean | string | number>
  ) => void
  type: 'DELIVERY' | 'PICKUP'
}

export function DeliveryChecklist({
  checklist,
  onChecklistChange,
  type,
}: DeliveryChecklistProps) {
  const items =
    type === 'DELIVERY' ? deliveryChecklistItems : pickupChecklistItems
  const currentChecklist = checklist || {}

  const handleChange = (key: string, value: boolean | string | number) => {
    onChecklistChange({
      ...currentChecklist,
      [key]: value,
    })
  }

  const getValue = (key: string, type: string): boolean | string | number => {
    const value = currentChecklist[key]
    if (type === 'boolean') {
      return value === true || value === 'true'
    }
    if (type === 'number') {
      return value ? Number(value) : ''
    }
    return (value as string) || ''
  }

  const getBooleanValue = (key: string): boolean => {
    const value = currentChecklist[key]
    return value === true || value === 'true'
  }

  const getStringValue = (key: string): string => {
    const value = currentChecklist[key]
    return (value as string) || ''
  }

  const getNumberValue = (key: string): number | '' => {
    const value = currentChecklist[key]
    return value ? Number(value) : ''
  }

  const completedCount = items.filter((item) => {
    if (item.type === 'boolean') {
      return getValue(item.key, 'boolean')
    }
    return currentChecklist[item.key]
  }).length

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Checklist de {type === 'DELIVERY' ? 'Entrega' : 'Coleta'}</span>
          <span className="text-sm font-normal text-gray-500">
            {completedCount}/{items.length} concluídos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.key} className="space-y-2">
            {item.type === 'boolean' ? (
              <div className="flex items-start gap-3">
                <Checkbox
                  id={item.key}
                  checked={getBooleanValue(item.key)}
                  onCheckedChange={(checked) =>
                    handleChange(item.key, checked === true)
                  }
                  className="mt-1"
                />
                <Label
                  htmlFor={item.key}
                  className={cn(
                    'flex-1 cursor-pointer',
                    item.required && 'font-medium'
                  )}
                >
                  {item.label}
                  {item.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                {getValue(item.key, 'boolean') ? (
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-300 shrink-0" />
                )}
              </div>
            ) : item.type === 'text' ? (
              <div className="space-y-2">
                <Label htmlFor={item.key}>
                  {item.label}
                  {item.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <Textarea
                  id={item.key}
                  value={getStringValue(item.key)}
                  onChange={(e) => handleChange(item.key, e.target.value)}
                  placeholder="Digite as observações..."
                  rows={3}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={item.key}>
                  {item.label}
                  {item.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <Input
                  id={item.key}
                  type="number"
                  value={getNumberValue(item.key)}
                  onChange={(e) =>
                    handleChange(
                      item.key,
                      e.target.value ? Number(e.target.value) : ''
                    )
                  }
                  placeholder="Digite o valor..."
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
