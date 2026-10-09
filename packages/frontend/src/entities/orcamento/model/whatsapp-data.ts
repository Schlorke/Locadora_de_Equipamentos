/**
 * Utilitários para integração com WhatsApp
 * Formata mensagens estruturadas para envio via WhatsApp Web API
 */

export interface WhatsAppQuoteData {
  // Dados do Cliente
  customerName: string
  customerPhone: string
  customerEmail: string
  customerCPF?: string
  customerCNPJ?: string
  customerCEP?: string
  customerMessage?: string

  // Dados do Pedido
  equipments: Array<{
    name: string
    quantity: number
    days: number
    unitPrice: number
    totalPrice: number
    link?: string
    discount?: {
      type: 'percentage' | 'fixed'
      value: number
      period: string
    }
  }>
  totalAmount: number
  /** Nome da própria locadora no cabeçalho e no rodapé da mensagem (achado 143); ausente, fica de fora. */
  storeName?: string
}

/**
 * Formata número de telefone para WhatsApp (remove caracteres especiais)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '')

  // Se começar com 55 (Brasil), mantém
  if (cleanPhone.startsWith('55')) {
    return cleanPhone
  }

  // Se começar com 0, remove o 0 e adiciona 55
  if (cleanPhone.startsWith('0')) {
    return `55${cleanPhone.substring(1)}`
  }

  // Se não tem código do país, adiciona 55
  return `55${cleanPhone}`
}

/**
 * Formata mensagem estruturada para WhatsApp
 */
export function formatWhatsAppMessage(data: WhatsAppQuoteData, sentAt: Date = new Date()): string {
  const {
    customerName,
    equipments,
    totalAmount,
    customerCPF,
    customerCNPJ,
    customerCEP,
    customerMessage,
  } = data
  const storeName = data.storeName?.trim()

  // Para habilitar rich preview no WhatsApp, colocar o link do 1º equipamento na primeira linha
  let message = ''
  const firstLink = equipments?.[0]?.link
  if (firstLink) {
    message += `${firstLink}\n\n`
  }

  message += `🏗️ *SOLICITAÇÃO DE ORÇAMENTO${storeName ? ` - ${storeName.toUpperCase()}` : ''}*\n\n`

  // Dados do Cliente
  message += `👤 *DADOS DO CLIENTE:*\n`
  message += `• Nome: ${customerName}\n`
  message += `• Telefone: ${data.customerPhone}\n`
  message += `• E-mail: ${data.customerEmail}\n`

  if (customerCPF) {
    message += `• CPF: ${customerCPF}\n`
  }

  if (customerCNPJ) {
    message += `• CNPJ: ${customerCNPJ}\n`
  }

  if (customerCEP) {
    message += `• CEP: ${customerCEP}\n`
  }

  message += `\n📦 *EQUIPAMENTOS SOLICITADOS:*\n`

  // Lista de equipamentos
  equipments.forEach((equipment, index) => {
    message += `\n${index + 1}. *${equipment.name}*\n`
    message += `   • Quantidade: ${equipment.quantity}x\n`
    message += `   • Período: ${equipment.days} dias\n`
    message += `   • Valor unitário: R$ ${equipment.unitPrice.toFixed(2)}\n`

    if (equipment.discount) {
      const discountText =
        equipment.discount.type === 'percentage'
          ? `${equipment.discount.value}%`
          : `R$ ${equipment.discount.value.toFixed(2)}`
      message += `   • Desconto ${equipment.discount.period}: -${discountText}\n`
    }

    message += `   • Subtotal: R$ ${equipment.totalPrice.toFixed(2)}\n`
  })

  message += `\n💰 *RESUMO FINANCEIRO:*\n`
  message += `• Total: R$ ${totalAmount.toFixed(2)}\n`

  if (customerMessage) {
    message += `\n📝 *OBSERVAÇÕES:*\n`
    message += `${customerMessage}\n`
  }

  message += `\n⏰ *SOLICITAÇÃO ENVIADA EM:* ${sentAt.toLocaleString('pt-BR')}\n`
  message += `\n📱 *Via Site${storeName ? ` ${storeName}` : ''}*`

  return message
}

/**
 * Gera URL do WhatsApp Web com mensagem pré-formatada
 */
export function generateWhatsAppURL(phone: string, message: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone)
  const encodedMessage = encodeURIComponent(message)

  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`
}

/**
 * Abre WhatsApp Web em nova aba com mensagem formatada
 */
/**
 * Converte dados do formulário para formato WhatsApp. `baseUrl` é a origem do site da própria locadora (no navegador,
 * `window.location.origin`) e `storeName` o nome dela: nunca um domínio ou marca fixos (achado 143).
 */
export function convertFormDataToWhatsApp(
  formData: {
    name: string
    phone: string
    email: string
    cpf?: string
    cnpj?: string
    cep?: string
    message?: string
  },
  equipments: Array<{
    name: string
    quantity: number
    days: number
    pricePerDay: number
    finalPrice?: number
    id?: string
    discount?: {
      type: 'percentage' | 'fixed'
      value: number
      period: string
    }
  }>,
  baseUrl: string,
  storeName?: string | null
): WhatsAppQuoteData {
  const totalAmount = equipments.reduce((total, eq) => {
    return total + (eq.finalPrice || eq.pricePerDay * eq.quantity * eq.days)
  }, 0)

  return {
    customerName: formData.name,
    customerPhone: formData.phone,
    customerEmail: formData.email,
    customerCPF: formData.cpf || undefined,
    customerCNPJ: formData.cnpj || undefined,
    customerCEP: formData.cep || undefined,
    customerMessage: formData.message || undefined,
    equipments: equipments.map((eq) => ({
      name: eq.name,
      quantity: eq.quantity,
      days: eq.days,
      unitPrice: eq.pricePerDay,
      totalPrice: eq.finalPrice || eq.pricePerDay * eq.quantity * eq.days,
      // Sem a origem do site (app nativo), a mensagem vai sem link: nunca um domínio fixo.
      link: eq.id && baseUrl ? `${baseUrl}/equipamentos/${eq.id}` : undefined,
      discount: eq.discount,
    })),
    totalAmount,
    ...(storeName?.trim() ? { storeName: storeName.trim() } : {}),
  }
}
