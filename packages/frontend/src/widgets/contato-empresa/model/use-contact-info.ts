import { usePublicSettings } from '../../../entities/configuracao'
import type { ContactInfoCardProps } from '../ui/contract'
export function useContactInfo(props: ContactInfoCardProps) {
  const { settings, isLoading, error } = usePublicSettings()
  const email = props.email || settings.contactEmail
  const phone = props.phone || settings.companyPhone
  const whatsapp = props.whatsapp || settings.whatsappNumber
  return {
    email,
    phone,
    whatsapp,
    address: props.address || settings.companyAddress,
    secondaryEmail: settings.marketingEmail,
    isLoading,
    error,
    hasContact: Boolean(
      email || phone || whatsapp || props.address || settings.companyAddress
    ),
    emailHref: email ? 'mailto:' + email : null,
    phoneHref: phone ? 'tel:+55' + phone.replace(/\D/g, '') : null,
    whatsappHref: whatsapp
      ? 'https://wa.me/55' + whatsapp.replace(/\D/g, '')
      : null,
  }
}
