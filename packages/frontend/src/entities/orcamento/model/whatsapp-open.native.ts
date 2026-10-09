import { Linking } from 'react-native';
import { formatWhatsAppMessage, generateWhatsAppURL, type WhatsAppQuoteData } from './whatsapp-data';
/** `businessPhone`: WhatsApp da própria locadora (configurações públicas); nunca um número fixo (achado 143). */
export async function openWhatsAppQuote(data: WhatsAppQuoteData, businessPhone: string): Promise<void> {
 await Linking.openURL(generateWhatsAppURL(businessPhone, formatWhatsAppMessage(data)));
}
