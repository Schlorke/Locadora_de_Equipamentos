'use client'
import { useState } from 'react'
import { toast } from '../../../shared/lib/toast'
export function useEquipmentSpecifications(
  onAdd: (key: string, value: string) => void
) {
  const [specKey, setSpecKey] = useState(''),
    [specValue, setSpecValue] = useState('')
  const handleAddSpecification = () => {
    if (specKey && specValue) {
      onAdd(specKey, specValue)
      setSpecKey('')
      setSpecValue('')
    } else
      toast.warning('Atenção', {
        description: 'Preencha a chave e o valor da especificação.',
      })
  }
  return {
    specKey,
    setSpecKey,
    specValue,
    setSpecValue,
    handleAddSpecification,
  }
}
