'use client'

import {
  RESPOSTA_RAPIDA,
  compromissosDeclarados,
  declarouTodos,
  faixasDoHorario,
  linhaDaFaixa,
  linhaLegal,
  usePublicSettings,
} from '../../../entities/configuracao'
import {
  copyrightDaLocadora,
  siglaDaLocadora,
  useIdentidadePublica,
} from '../../../entities/organizacao'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Facebook, Instagram, Linkedin } from './icones-marca.web'
import Image from 'next/image'
import { Link } from '@gb-locacoes/ui'

const socialLinkBaseClasses =
  'flex items-center justify-center p-2 rounded-md bg-transparent border-none text-gray-300 transition-all duration-300 ease-in-out hover:scale-105 hover:bg-orange-600/20 hover:text-orange-500'

function SocialLink({
  href,
  ariaLabel,
  icon,
}: {
  href?: string
  ariaLabel: string
  icon: React.ReactNode
}) {
  const url = href?.trim()
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={socialLinkBaseClasses}
        aria-label={ariaLabel}
      >
        {icon}
      </a>
    )
  }
  return (
    <span className={socialLinkBaseClasses} aria-label={ariaLabel}>
      {icon}
    </span>
  )
}

const LINK_LEGAL =
  'text-sm text-gray-400 transition-all duration-300 ease-in-out hover:text-orange-500'

/**
 * Rodapé da vitrine só com os dados da própria locadora: nome e sigla do cartão público; texto, redes, contato,
 * endereço e horário das configurações públicas dela; nome empresarial e CNPJ da organização (achado 147). Dado
 * ausente fica de fora (achado 143, T12): nunca o nome, o CNPJ, o endereço, os horários ou as redes de outra locadora.
 * Onda 134: a coluna "Equipamentos" vem dos destaques da própria locadora, os links legais só dos documentos que ela
 * publicou (Cookies é da plataforma e fica sempre) e a resposta rápida só com o compromisso declarado.
 */
export default function Footer() {
  const { settings } = usePublicSettings()
  const identidade = useIdentidadePublica()
  const nome = identidade?.nome ?? null
  const telefone = settings.companyPhone.trim()
  const whatsapp = settings.whatsappNumber.trim()
  const email = settings.contactEmail.trim()
  const addressLines = (() => {
    const raw = settings.companyAddress?.trim()
    if (!raw) return []
    const [firstLine, ...rest] = raw.split(' - ')
    if (rest.length === 0) {
      return [firstLine]
    }
    return [firstLine, rest.join(' - ')]
  })()
  // Horário aberto ("Seg-Sex: 8h às 18h", como na produção) e a linha do CNPJ, da própria locadora.
  const faixas = faixasDoHorario(settings.businessHours).filter(
    (faixa) => faixa.horario !== null
  )
  const legal = linhaLegal(settings.legalIdentity, nome)
  const destaques = settings.siteContent?.footerHighlights ?? []
  const publicados = settings.legalDocuments
  const respostaRapida = declarouTodos(
    compromissosDeclarados(settings.siteContent),
    RESPOSTA_RAPIDA.requer
  )
  const temContato = Boolean(
    telefone ||
    whatsapp ||
    email ||
    addressLines.length > 0 ||
    faixas.length > 0 ||
    legal
  )

  return (
    <footer className="relative bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Company Info */}
          <div className="flex flex-col space-y-3">
            <div className="flex items-center space-x-3">
              {settings.companyIconUrl ? (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg transition-all duration-200 hover:scale-105 bg-white">
                  <Image
                    src={settings.companyIconUrl}
                    alt={nome ?? 'Logo da locadora'}
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>
              ) : nome ? (
                <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white p-2.5 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 hover:scale-105">
                  {siglaDaLocadora(nome)}
                </div>
              ) : null}
              <div>
                {nome ? (
                  <div className="font-display text-xl font-bold text-orange-500">
                    {nome}
                  </div>
                ) : null}
                <div className="text-sm text-gray-400">
                  Equipamentos para Construção
                </div>
              </div>
            </div>
            {settings.aboutUsText.trim() ? (
              <p className="text-base leading-relaxed text-gray-300">
                {settings.aboutUsText}
              </p>
            ) : null}
            <div className="flex space-x-3">
              <SocialLink
                href={
                  (settings.socialLinks as { facebook?: string } | undefined)
                    ?.facebook
                }
                ariaLabel="Facebook"
                icon={<Facebook className="h-5 w-5" />}
              />
              <SocialLink
                href={
                  (settings.socialLinks as { instagram?: string } | undefined)
                    ?.instagram
                }
                ariaLabel="Instagram"
                icon={<Instagram className="h-5 w-5" />}
              />
              <SocialLink
                href={
                  (settings.socialLinks as { linkedin?: string } | undefined)
                    ?.linkedin
                }
                ariaLabel="LinkedIn"
                icon={<Linkedin className="h-5 w-5" />}
              />
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col space-y-2">
            <h3 className="font-display text-lg font-bold text-orange-500 mb-2">
              Links Rápidos
            </h3>
            <ul className="flex flex-col space-y-2">
              <li>
                <Link
                  href="/#equipamentos-destaque"
                  className="inline-block transform transition-all duration-300 ease-in-out text-gray-300 hover:translate-x-1 hover:text-orange-500"
                >
                  Catálogo de Equipamentos
                </Link>
              </li>
              <li>
                <Link
                  href="/#categorias"
                  className="inline-block transform transition-all duration-300 ease-in-out text-gray-300 hover:translate-x-1 hover:text-orange-500"
                >
                  Categorias
                </Link>
              </li>
              <li>
                <Link
                  href="/orcamento"
                  className="inline-block transform transition-all duration-300 ease-in-out text-gray-300 hover:translate-x-1 hover:text-orange-500"
                >
                  Solicitar Orçamento
                </Link>
              </li>
              <li>
                <Link
                  href="/sobre"
                  className="inline-block transform transition-all duration-300 ease-in-out text-gray-300 hover:translate-x-1 hover:text-orange-500"
                >
                  Sobre Nós
                </Link>
              </li>
              <li>
                <Link
                  href="/contato"
                  className="inline-block transform transition-all duration-300 ease-in-out text-gray-300 hover:translate-x-1 hover:text-orange-500"
                >
                  Contato
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="inline-block transform transition-all duration-300 ease-in-out text-gray-300 hover:translate-x-1 hover:text-orange-500"
                >
                  Área do Cliente
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories: destaques da própria locadora (sem destaques, a coluna sai) */}
          {destaques.length > 0 ? (
            <div className="flex flex-col space-y-2">
              <h3 className="font-display text-lg font-bold text-orange-500 mb-2">
                Equipamentos
              </h3>
              <ul className="flex flex-col space-y-2">
                {destaques.map((destaque) => (
                  <li key={destaque}>
                    <Link
                      href="/equipamentos"
                      className="inline-block transform transition-all duration-300 ease-in-out text-gray-300 hover:translate-x-1 hover:text-orange-500"
                    >
                      {destaque}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Contact Info: só o que a locadora informou */}
          {temContato ? (
            <div className="flex flex-col space-y-2">
              <h3 className="font-display text-lg font-bold text-orange-500 mb-2">
                Contato
              </h3>
              <div className="flex flex-col space-y-2">
                {telefone || whatsapp ? (
                  <div className="flex items-start space-x-3">
                    <Phone className="w-5 h-5 min-w-5 min-h-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      {telefone ? (
                        <Link
                          href={`tel:+55${telefone.replace(/\D/g, '')}`}
                          className="text-sm text-gray-300 transition-colors duration-300 ease-in-out hover:text-orange-500"
                        >
                          {telefone}
                        </Link>
                      ) : null}
                      {telefone && whatsapp ? <br /> : null}
                      {whatsapp ? (
                        <Link
                          href={`tel:+55${whatsapp.replace(/\D/g, '')}`}
                          className="text-sm text-gray-300 transition-colors duration-300 ease-in-out hover:text-orange-500"
                        >
                          {whatsapp}
                        </Link>
                      ) : null}
                      <p className="text-sm text-gray-400">
                        Atendimento especializado
                      </p>
                    </div>
                  </div>
                ) : null}

                {email ? (
                  <div className="flex items-start space-x-3">
                    <Mail className="w-5 h-5 min-w-5 min-h-5 text-orange-500 mt-0.5 shrink-0" />
                    <div className="flex flex-col space-y-1">
                      <Link
                        href={`mailto:${email}`}
                        className="text-sm text-gray-300 transition-colors duration-300 ease-in-out hover:text-orange-500"
                      >
                        {email}
                      </Link>
                      {settings.marketingEmail && (
                        <Link
                          href={`mailto:${settings.marketingEmail}`}
                          className="text-sm text-gray-300 transition-colors duration-300 ease-in-out hover:text-orange-500"
                        >
                          {settings.marketingEmail}
                        </Link>
                      )}
                      {respostaRapida ? (
                        <p className="text-sm text-gray-400">
                          {RESPOSTA_RAPIDA.texto}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {addressLines.length > 0 ? (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 min-w-5 min-h-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-gray-300 transition-colors duration-300 ease-in-out hover:text-orange-500 cursor-default">
                        {addressLines.map((line, index) => (
                          <span key={index}>
                            {line}
                            {index < addressLines.length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                      <p className="text-sm text-gray-400">
                        Entregamos em toda região
                      </p>
                    </div>
                  </div>
                ) : null}

                {faixas.length > 0 || legal ? (
                  <div className="flex items-start space-x-3">
                    <Clock className="h-5 w-5 text-orange-500 mt-1" />
                    <div>
                      {faixas.map((faixa) => (
                        <p
                          key={faixa.diasCurto}
                          className="text-sm text-gray-300 transition-colors duration-300 ease-in-out hover:text-orange-500 cursor-default"
                        >
                          {linhaDaFaixa(faixa, 'curto')}
                        </p>
                      ))}
                      {legal ? (
                        <p className="text-sm text-gray-400">{legal}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-gray-700 pt-8 md:flex-row">
          <p className="text-sm text-gray-400">{copyrightDaLocadora(nome)}</p>
          <div className="mt-4 flex space-x-8 md:mt-0">
            {publicados?.privacy ? (
              <Link href="/privacidade" className={LINK_LEGAL}>
                Privacidade
              </Link>
            ) : null}
            {publicados?.terms ? (
              <Link href="/termos" className={LINK_LEGAL}>
                Termos
              </Link>
            ) : null}
            <Link href="/cookies" className={LINK_LEGAL}>
              Cookies
            </Link>
            {publicados?.returnPolicy ? (
              <Link href="/politica-devolucao" className={LINK_LEGAL}>
                Devolução
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  )
}
