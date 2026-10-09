'use client'

import { useEquipmentSpecifications } from '../model/use-equipment-specifications'
import { Button } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { PlusCircle, Trash2 } from 'lucide-react'

interface SpecificationsSectionProps {
  specifications: Record<string, string>
  onAdd: (_key: string, _value: string) => void
  onRemove: (_key: string) => void
  onKeyDown: (_e: React.KeyboardEvent) => void
}

export function SpecificationsSection({
  specifications,
  onAdd,
  onRemove,
  onKeyDown,
}: SpecificationsSectionProps) {
  const {
    specKey,
    setSpecKey,
    specValue,
    setSpecValue,
    handleAddSpecification,
  } = useEquipmentSpecifications(onAdd)

  return (
    <div className="space-y-6 border-t border-gray-100 pt-6">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
          <span className="text-xs font-medium text-purple-600">4</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900">
          Especificações Técnicas
        </h3>
        <span className="text-sm text-gray-500">(Opcional)</span>
      </div>

      <div className="space-y-4">
        {Object.entries(specifications).length > 0 && (
          <div className="space-y-3">
            {Object.entries(specifications).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{key}</div>
                  <div className="text-sm text-gray-700 mt-1">
                    {String(value)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(key)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-100 shrink-0 ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white/50 border-2 border-dashed border-gray-300 rounded-lg p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label
                  htmlFor="specKey"
                  className="text-sm font-medium text-gray-700"
                >
                  Nome da Especificação
                </Label>
                <Input
                  id="specKey"
                  value={specKey}
                  onChange={(e) => setSpecKey(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ex: Peso"
                  className="mt-2"
                />
              </div>
              <div>
                <Label
                  htmlFor="specValue"
                  className="text-sm font-medium text-gray-700"
                >
                  Valor
                </Label>
                <Input
                  id="specValue"
                  value={specValue}
                  onChange={(e) => setSpecValue(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ex: 150kg"
                  className="mt-2"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSpecification}
              className="w-fit px-4 border-gray-200 hover:bg-background hover:text-foreground hover:scale-105 hover:shadow-sm transition-all duration-300 group"
            >
              <PlusCircle className="h-4 w-4 mr-2 group-hover:text-orange-500 transition-colors duration-200" />
              <span className="group-hover:text-orange-500 transition-colors duration-200">
                Adicionar Especificação
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
