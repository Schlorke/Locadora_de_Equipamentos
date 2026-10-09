'use client'

import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import { GoogleStoreLocator } from '../../../features/mapa-loja'
import {
  RESPOSTA_RAPIDA,
  compromissosDeclarados,
  declarouTodos,
  faixasDoHorario,
  linhaDaFaixa,
  linhaLegal,
  localDaLoja,
  usePublicSettings,
} from '../../../entities/configuracao'
import { useIdentidadePublica } from '../../../entities/organizacao'
import { toast } from '../../../shared/lib'
import { Clock, Mail, Phone, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ContactSection() {
  const { settings } = usePublicSettings()
  // Horário aberto e CNPJ da própria locadora (configurações públicas e organização; achado 147), como na produção:
  // "Segunda a Sexta: 8h às 18h", "Sábado: 8h às 12h" e a linha do CNPJ. Sem horário, o cartão fica de fora.
  const nomeDaVitrine = useIdentidadePublica()?.nome ?? null
  const faixasAbertas = faixasDoHorario(settings.businessHours).filter(
    (faixa) => faixa.horario !== null
  )
  const linhaDoCnpj = linhaLegal(settings.legalIdentity, nomeDaVitrine)
  // Onda 134: o mapa só com o local que a própria locadora declarou, e a linha de resposta só com o compromisso dela.
  const local = localDaLoja(settings.siteContent, nomeDaVitrine)
  const respostaRapida = declarouTodos(
    compromissosDeclarados(settings.siteContent),
    RESPOSTA_RAPIDA.requer
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    cep: '',
    company: '',
    materials: '',
    cpf: '',
    cnpj: '',
    message: '',
  })

  // Funções de formatação
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9)
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
    if (numbers.length <= 8)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
    if (numbers.length <= 12)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
  }

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 5) return numbers
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value)
    setFormData((prev) => ({ ...prev, cpf: formatted }))
  }

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setFormData((prev) => ({ ...prev, cnpj: formatted }))
  }

  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value)
    setFormData((prev) => ({ ...prev, cep: formatted }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validação: CPF ou CNPJ obrigatório
    if (!formData.cpf.trim() && !formData.cnpj.trim()) {
      toast.error('Erro de Validação', {
        description: 'Por favor, preencha pelo menos o CPF ou CNPJ.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          cep: formData.cep || undefined,
          company: formData.company || undefined,
          equipment: formData.materials || undefined,
          cpf: formData.cpf || undefined,
          cnpj: formData.cnpj || undefined,
          message: formData.message,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Limpar URL
        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState({}, '', window.location.pathname)
        }

        // Limpar formulário
        setFormData({
          name: '',
          phone: '',
          email: '',
          cep: '',
          company: '',
          materials: '',
          cpf: '',
          cnpj: '',
          message: '',
        })

        toast.success('Orçamento Enviado com Sucesso! 🎉', {
          description:
            'Entraremos em contato em até 2 horas úteis. Você receberá uma cópia no seu email.',
          duration: 8000,
        })
      } else {
        throw new Error(data.message || 'Erro ao enviar')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao Enviar', {
        description:
          error instanceof Error
            ? error.message
            : 'Tente novamente em alguns instantes.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="bg-gray-50 py-12 md:py-16 lg:py-20 overflow-hidden">
      {/* Container com largura consistente */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2
            className="section-title text-3xl md:text-4xl font-bold text-gray-900 mb-4 motion-safe:opacity-0"
            style={{ transition: 'none' }}
          >
            Entre em Contato
          </h2>
          <p
            className="section-subtitle text-xl text-gray-600 max-w-2xl mx-auto motion-safe:opacity-0"
            style={{ transition: 'none' }}
          >
            Estamos prontos para atender sua necessidade de equipamentos para
            construção civil. Fale conosco!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          {/* A transição do .contact-form é do CSS (styles/components.web.css); a revelação só mexe em opacity/transform. */}
          <Card className="contact-form shadow-xl border-0 motion-safe:opacity-0">
            <CardContent className="p-6 pt-8 lg:p-8">
              <h3 className="text-2xl font-semibold mb-6">
                Solicite um Orçamento de Equipamentos
              </h3>
              <form
                onSubmit={handleSubmit}
                className="space-y-6"
                suppressHydrationWarning
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="group">
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                    >
                      Nome Completo *
                    </label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                      placeholder="Seu nome completo"
                      className="transition-all focus:scale-105"
                    />
                  </div>
                  <div className="group">
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                    >
                      Telefone *
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      required
                      placeholder="(51) 99999-9999"
                      className="transition-all focus:scale-105"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="group">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                    >
                      E-mail *
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                      placeholder="seu@email.com"
                      className="transition-all focus:scale-105"
                    />
                  </div>
                  <div className="group">
                    <label
                      htmlFor="cep"
                      className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                    >
                      CEP
                    </label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      placeholder="00000-000"
                      maxLength={9}
                      onChange={handleCEPChange}
                      className="transition-all focus:scale-105"
                    />
                  </div>
                </div>

                <div className="group">
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                  >
                    Empresa/Construtora
                  </label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        company: e.target.value,
                      }))
                    }
                    placeholder="Nome da sua empresa ou construtora"
                    className="transition-all focus:scale-105"
                  />
                </div>

                <div className="group">
                  <label
                    htmlFor="materials"
                    className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                  >
                    Equipamentos de Interesse
                  </label>
                  <Input
                    id="materials"
                    value={formData.materials}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        materials: e.target.value,
                      }))
                    }
                    placeholder="Ex: andaime suspenso, cadeira elétrica, betoneira"
                    className="transition-all focus:scale-105"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="group">
                    <label
                      htmlFor="cpf"
                      className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                    >
                      CPF
                    </label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      onChange={handleCPFChange}
                      className="transition-all focus:scale-105"
                    />
                  </div>
                  <div className="group">
                    <label
                      htmlFor="cnpj"
                      className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                    >
                      CNPJ
                    </label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      onChange={handleCNPJChange}
                      className="transition-all focus:scale-105"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500 -mt-2">
                  * Informe pelo menos o CPF ou CNPJ
                </p>

                <div className="group">
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-orange-600 transition-colors"
                  >
                    Mensagem
                  </label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        message: e.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Descreva sua necessidade, período de locação, local da obra, altura necessária..."
                    className="transition-all focus:scale-105"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full hover:scale-105 transition-all duration-300 hover:shadow-lg h-12 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Solicitação'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div
            className="contact-info space-y-8 motion-safe:opacity-0"
            style={{ transition: 'none' }}
          >
            {/* Card com Mapa (simplificado na homepage), só com o local da locadora */}
            {local ? (
              <Card className="contact-card shadow-xl group border-0 overflow-hidden rounded-lg">
                <CardContent className="p-0">
                  {mounted ? (
                    <GoogleStoreLocator
                      className="h-[320px] w-full"
                      simplified
                      location={local}
                    />
                  ) : (
                    <div className="h-[320px] w-full bg-slate-100 animate-pulse" />
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Card Telefone */}
            <Card className="contact-card shadow-xl hover:scale-105 group border-0">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 p-3 rounded-full group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Phone className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2 group-hover:text-orange-600 transition-colors">
                      Telefone
                    </h4>
                    <p className="text-gray-600 mb-1" suppressHydrationWarning>
                      {settings.companyPhone}
                    </p>
                    <p className="text-gray-600" suppressHydrationWarning>
                      {settings.whatsappNumber}
                    </p>
                    <p className="text-sm text-orange-600 mt-2">
                      Atendimento especializado
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card E-mail */}
            <Card className="contact-card shadow-xl hover:scale-105 group border-0">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 p-3 rounded-full group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Mail className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2 group-hover:text-orange-600 transition-colors">
                      E-mail
                    </h4>
                    <p className="text-gray-600 mb-1" suppressHydrationWarning>
                      <a
                        href={`mailto:${settings.contactEmail}`}
                        className="hover:underline"
                      >
                        {settings.contactEmail}
                      </a>
                    </p>
                    {settings.marketingEmail && (
                      <p className="text-gray-600" suppressHydrationWarning>
                        <a
                          href={`mailto:${settings.marketingEmail}`}
                          className="hover:underline"
                        >
                          {settings.marketingEmail}
                        </a>
                      </p>
                    )}
                    {respostaRapida ? (
                      <p className="text-sm text-orange-600 mt-2">
                        {`${RESPOSTA_RAPIDA.texto} · Automação comercial`}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Horário */}
            {faixasAbertas.length > 0 ? (
              <Card className="contact-card shadow-xl hover:scale-105 group border-0">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-orange-100 p-3 rounded-full group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-2 group-hover:text-orange-600 transition-colors">
                        Horário de Funcionamento
                      </h4>
                      <div className="text-gray-600 space-y-1">
                        {faixasAbertas.map((faixa) => (
                          <p key={faixa.dias}>{linhaDaFaixa(faixa, 'longo')}</p>
                        ))}
                        {linhaDoCnpj ? (
                          <p className="text-sm text-orange-600 mt-2">
                            {linhaDoCnpj}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
