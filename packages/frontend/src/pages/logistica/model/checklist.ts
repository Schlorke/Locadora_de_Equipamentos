interface ChecklistItem {
  key: string
  label: string
  type: 'boolean' | 'text' | 'number'
  required?: boolean
}

export const deliveryChecklistItems: ChecklistItem[] = [
  {
    key: 'equipment_checked',
    label: 'Equipamento verificado e funcionando',
    type: 'boolean',
    required: true,
  },
  {
    key: 'accessories_complete',
    label: 'Acessórios completos',
    type: 'boolean',
    required: true,
  },
  {
    key: 'visual_inspection',
    label: 'Inspeção visual realizada',
    type: 'boolean',
    required: true,
  },
  {
    key: 'documentation_provided',
    label: 'Documentação fornecida',
    type: 'boolean',
    required: true,
  },
  {
    key: 'customer_present',
    label: 'Cliente presente na entrega',
    type: 'boolean',
    required: false,
  },
  {
    key: 'customer_signature',
    label: 'Assinatura do cliente obtida',
    type: 'boolean',
    required: true,
  },
  {
    key: 'condition_notes',
    label: 'Observações sobre condição',
    type: 'text',
    required: false,
  },
  {
    key: 'odometer_reading',
    label: 'Leitura do odômetro/horímetro',
    type: 'number',
    required: false,
  },
]

export const pickupChecklistItems: ChecklistItem[] = [
  {
    key: 'equipment_returned',
    label: 'Equipamento devolvido',
    type: 'boolean',
    required: true,
  },
  {
    key: 'accessories_returned',
    label: 'Acessórios devolvidos',
    type: 'boolean',
    required: true,
  },
  {
    key: 'visual_inspection',
    label: 'Inspeção visual realizada',
    type: 'boolean',
    required: true,
  },
  {
    key: 'damage_detected',
    label: 'Danos detectados',
    type: 'boolean',
    required: false,
  },
  {
    key: 'damage_description',
    label: 'Descrição dos danos',
    type: 'text',
    required: false,
  },
  {
    key: 'customer_present',
    label: 'Cliente presente na coleta',
    type: 'boolean',
    required: false,
  },
  {
    key: 'customer_signature',
    label: 'Assinatura do cliente obtida',
    type: 'boolean',
    required: true,
  },
  {
    key: 'condition_notes',
    label: 'Observações sobre condição',
    type: 'text',
    required: false,
  },
  {
    key: 'odometer_reading',
    label: 'Leitura do odômetro/horímetro',
    type: 'number',
    required: false,
  },
]
