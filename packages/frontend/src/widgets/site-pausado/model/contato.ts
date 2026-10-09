/** Contato público da locadora (configurações públicas), mostrado com o site em pausa. */
export interface ContatoDaLocadora {
  readonly telefone?: string
  readonly whatsapp?: string
  readonly email?: string
}

export interface LinkDeContato {
  readonly rotulo: 'Telefone' | 'WhatsApp' | 'E-mail'
  readonly valor: string
  readonly href: string
}

const digitos = (valor: string) => valor.replace(/\D/g, '')

/**
 * Links de contato na ordem telefone, WhatsApp e e-mail, com as mesmas convenções do cartão de contato da vitrine
 * (`tel:+55`, `https://wa.me/55`, `mailto:`). Valor vazio ou sem dígitos fica de fora.
 */
export function linksDeContato(contato: ContatoDaLocadora): LinkDeContato[] {
  const links: LinkDeContato[] = []
  const telefone = contato.telefone?.trim()
  if (telefone && digitos(telefone))
    links.push({
      rotulo: 'Telefone',
      valor: telefone,
      href: 'tel:+55' + digitos(telefone),
    })
  const whatsapp = contato.whatsapp?.trim()
  if (whatsapp && digitos(whatsapp))
    links.push({
      rotulo: 'WhatsApp',
      valor: whatsapp,
      href: 'https://wa.me/55' + digitos(whatsapp),
    })
  const email = contato.email?.trim()
  if (email && /^[^\s@]+@[^\s@]+$/.test(email))
    links.push({ rotulo: 'E-mail', valor: email, href: 'mailto:' + email })
  return links
}
