'use client'
import type React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Label, Textarea } from '../../../shared/ui'
import {
  useContactForm,
  formatPhone,
  formatCPF,
  formatCNPJ,
} from '../model/use-contact-form'
export default function ContactForm() {
  const {
    formData,
    setFormData,
    isSubmitting,
    handleSubmit: submit,
  } = useContactForm()
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void submit()
  }
  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((previous) => ({
      ...previous,
      phone: formatPhone(event.target.value),
    }))
  const handleCPFChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((previous) => ({
      ...previous,
      cpf: formatCPF(event.target.value),
    }))
  const handleCNPJChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((previous) => ({
      ...previous,
      cnpj: formatCNPJ(event.target.value),
    }))
  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      suppressHydrationWarning
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nome Completo *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Seu nome completo"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefone *</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="(51) 99999-9999"
            required
            maxLength={15}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email">E-mail *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          placeholder="seu@email.com"
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="company">Empresa/Construtora</Label>
        <Input
          id="company"
          value={formData.company}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, company: e.target.value }))
          }
          placeholder="Nome da empresa (opcional)"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="equipment">Equipamento de Interesse</Label>
        <Input
          id="equipment"
          value={formData.equipment}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, equipment: e.target.value }))
          }
          placeholder="Ex: Betoneira, Andaime, etc."
          className="mt-1"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            value={formData.cpf}
            onChange={handleCPFChange}
            placeholder="000.000.000-00"
            maxLength={14}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={formData.cnpj}
            onChange={handleCNPJChange}
            placeholder="00.000.000/0000-00"
            maxLength={18}
            className="mt-1"
          />
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        * Informe pelo menos o CPF ou CNPJ
      </p>

      <div>
        <Label htmlFor="message">Mensagem *</Label>
        <Textarea
          id="message"
          value={formData.message}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, message: e.target.value }))
          }
          placeholder="Descreva seu projeto e necessidades..."
          rows={6}
          required
          className="mt-1"
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="w-fit mx-auto hover:scale-105 transition-transform duration-200 flex items-center gap-2"
          size="lg"
          disabled={isSubmitting}
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
      </div>
    </form>
  )
}
