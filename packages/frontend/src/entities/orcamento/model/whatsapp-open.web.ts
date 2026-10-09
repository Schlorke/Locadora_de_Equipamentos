import { formatWhatsAppMessage, generateWhatsAppURL, type WhatsAppQuoteData } from './whatsapp-data';
export function openWhatsAppQuote(
  data: WhatsAppQuoteData,
  /** WhatsApp da própria locadora (configurações públicas); nunca um número fixo (achado 143). */
  businessPhone: string
): void {
  const message = formatWhatsAppMessage(data)
  const url = generateWhatsAppURL(businessPhone, message)

  // Detectar se é dispositivo móvel
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )

  if (isMobile) {
    // Para dispositivos móveis, usar window.location.href para abrir o app diretamente
    window.location.href = url

    // Limpar URL após um pequeno delay para evitar dados sensíveis na URL
    setTimeout(() => {
      if (
        typeof window !== 'undefined' &&
        window.history &&
        window.history.replaceState
      ) {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }, 1000)
  } else {
    // Para desktop, usar window.open como antes
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

