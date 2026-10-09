// Telefone e WhatsApp no hero (onda 134, achado do lote contato-separador): só os números que a própria locadora
// informou, aparados, com o "|" só entre os dois; sem nenhum, o bloco do telefone sai (a região de entrega fica). Com os
// dois (a GB), a marcação da produção (main eb4c0098, components/hero.tsx), que mostrava os números no hero.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import Hero from './Hero.web'

const TELEFONE = '(51) 3000-0000'
const WHATSAPP = '(51) 99999-0000'

/** Hero com a leitura inicial do SSR (o host web passa os números junto com o carrossel, a onda e o conteúdo). */
const hero = (numeros: { companyPhone?: string; whatsappNumber?: string }) =>
  renderToStaticMarkup(
    <Hero
      initialSettings={{ heroCarousel: [], waveAnimation: 'none', ...numeros }}
    />
  )

/** Bloco de contato do hero (telefone e região), do início do `.hero-contact` ao texto da região. */
const contato = (html: string) =>
  html.match(
    /<div class="hero-contact[\s\S]*?Entregamos em toda região/
  )?.[0] ?? ''

/** Bloco do telefone na marcação da produção (main eb4c0098), com os números já preenchidos. */
const numerosDaProducao = (telefone: string, whatsapp: string) =>
  '<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">' +
  `<div class="sm:hidden"><a href="tel:+55${whatsapp.replace(/\D/g, '')}" class="hover:underline">${whatsapp}</a></div>` +
  '<div class="hidden sm:flex sm:items-center sm:gap-2">' +
  `<a href="tel:+55${telefone.replace(/\D/g, '')}" class="hover:underline">${telefone}</a>` +
  '<span>|</span>' +
  `<a href="tel:+55${whatsapp.replace(/\D/g, '')}" class="hover:underline">${whatsapp}</a>` +
  '</div></div>'

describe('Hero: telefone e WhatsApp da locadora', () => {
  it('com os dois números (a GB): a marcação da produção, com o "|" entre eles', () => {
    const bloco = contato(
      hero({ companyPhone: TELEFONE, whatsappNumber: WHATSAPP })
    )
    expect(bloco).toContain(
      '<div class="flex items-center gap-2 hover:text-white transition-colors cursor-pointer group"><svg'
    )
    expect(bloco).toContain('lucide-phone h-5 w-5 group-hover:animate-bounce')
    expect(bloco).toContain(numerosDaProducao(TELEFONE, WHATSAPP) + '</div>')
  })

  it('só o telefone: o número no celular e no desktop, sem "|" nem link vazio', () => {
    const bloco = contato(hero({ companyPhone: TELEFONE, whatsappNumber: '' }))
    expect(bloco).toContain('lucide-phone')
    // No celular a produção mostra só o WhatsApp; sem ele, o telefone, e nunca o ícone sozinho.
    expect(bloco).toContain(
      `<div class="sm:hidden"><a href="tel:+555130000000" class="hover:underline">${TELEFONE}</a></div><div class="hidden sm:flex sm:items-center sm:gap-2"><a href="tel:+555130000000" class="hover:underline">${TELEFONE}</a></div>`
    )
    expect(bloco).not.toContain('<span>|</span>')
    expect(bloco).not.toContain('href="tel:+55"')
  })

  it('só o WhatsApp: o número no celular e no desktop, sem "|"', () => {
    const bloco = contato(hero({ companyPhone: '', whatsappNumber: WHATSAPP }))
    expect(bloco).toContain(
      `<div class="sm:hidden"><a href="tel:+5551999990000" class="hover:underline">${WHATSAPP}</a></div><div class="hidden sm:flex sm:items-center sm:gap-2"><a href="tel:+5551999990000" class="hover:underline">${WHATSAPP}</a></div>`
    )
    expect(bloco).not.toContain('<span>|</span>')
    expect(bloco).not.toContain('href="tel:+55"')
  })

  it('com algum número, o celular nunca fica só com o ícone', () => {
    for (const numeros of [
      { companyPhone: TELEFONE, whatsappNumber: WHATSAPP },
      { companyPhone: TELEFONE, whatsappNumber: '' },
      { companyPhone: ` ${TELEFONE} `, whatsappNumber: '  ' },
      { companyPhone: '', whatsappNumber: WHATSAPP },
    ]) {
      const bloco = contato(hero(numeros))
      expect(bloco).not.toContain('<div class="sm:hidden"></div>')
      expect(bloco).toMatch(
        /<div class="sm:hidden"><a href="tel:\+55\d+" class="hover:underline">\(\d{2}\) [\d-]+<\/a><\/div>/
      )
    }
  })

  it('número só com espaços não conta, e o número sai aparado', () => {
    const bloco = contato(
      hero({ companyPhone: '   ', whatsappNumber: `  ${WHATSAPP}  ` })
    )
    expect(bloco).toContain(`>${WHATSAPP}</a>`)
    expect(bloco).not.toContain('<span>|</span>')
    expect(bloco).not.toContain('href="tel:+55"')
  })

  it('sem nenhum número (e sem a leitura deles): o bloco do telefone sai e a região de entrega fica', () => {
    for (const numeros of [{ companyPhone: '', whatsappNumber: ' ' }, {}]) {
      const bloco = contato(hero(numeros))
      expect(bloco).not.toContain('lucide-phone')
      expect(bloco).not.toContain('|')
      expect(bloco).not.toContain('tel:')
      expect(bloco).toContain('lucide-map-pin')
      expect(bloco).toMatch(/<span>Entregamos em toda região$/)
    }
  })
})
