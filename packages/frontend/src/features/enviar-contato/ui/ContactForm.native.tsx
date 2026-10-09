'use client'
import { Loader2 } from 'lucide-react-native'
import { Button, Input, Label, Textarea } from '../../../shared/ui'
import {
  useContactForm,
  formatPhone,
  formatCPF,
  formatCNPJ,
} from '../model/use-contact-form'
export default function ContactForm() {
  const { formData, setFormData, isSubmitting, handleSubmit } = useContactForm()
  return (
    <>
      <Label>Nome Completo *</Label>
      <Input
        value={formData.name}
        onChangeText={(name) => setFormData((prev) => ({ ...prev, name }))}
        placeholder="Seu nome completo"
      />

      <Label>Telefone *</Label>
      <Input
        type="tel"
        value={formData.phone}
        onChangeText={(phone) =>
          setFormData((prev) => ({ ...prev, phone: formatPhone(phone) }))
        }
        placeholder="(51) 99999-9999"
      />

      <Label>E-mail *</Label>
      <Input
        type="email"
        value={formData.email}
        onChangeText={(email) => setFormData((prev) => ({ ...prev, email }))}
        placeholder="seu@email.com"
      />

      <Label>Empresa/Construtora</Label>
      <Input
        value={formData.company}
        onChangeText={(company) =>
          setFormData((prev) => ({ ...prev, company }))
        }
        placeholder="Nome da empresa (opcional)"
      />

      <Label>Equipamento de Interesse</Label>
      <Input
        value={formData.equipment}
        onChangeText={(equipment) =>
          setFormData((prev) => ({ ...prev, equipment }))
        }
        placeholder="Ex: Betoneira, Andaime, etc."
      />

      <Label>CPF</Label>
      <Input
        value={formData.cpf}
        onChangeText={(cpf) =>
          setFormData((prev) => ({ ...prev, cpf: formatCPF(cpf) }))
        }
        placeholder="000.000.000-00"
      />

      <Label>CNPJ</Label>
      <Input
        value={formData.cnpj}
        onChangeText={(cnpj) =>
          setFormData((prev) => ({ ...prev, cnpj: formatCNPJ(cnpj) }))
        }
        placeholder="00.000.000/0000-00"
      />

      <Label>Mensagem *</Label>
      <Textarea
        value={formData.message}
        onChangeText={(message) =>
          setFormData((prev) => ({ ...prev, message }))
        }
        placeholder="Descreva seu projeto e necessidades..."
      />

      <Button size="lg" disabled={isSubmitting} onClick={handleSubmit}>
        {isSubmitting ? (
          <>
            <Loader2 />
            Enviando...
          </>
        ) : (
          'Enviar Solicitação'
        )}
      </Button>
    </>
  )
}
