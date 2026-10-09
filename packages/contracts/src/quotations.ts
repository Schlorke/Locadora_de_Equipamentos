import { z } from 'zod'

// Esquema para endereço de entrega
const DeliveryAddressSchema = z.object({
  cep: z.string().describe('CEP'),
  logradouro: z.string().describe('Logradouro'),
  numero: z.string().describe('Número'),
  complemento: z.string().optional().describe('Complemento'),
  bairro: z.string().describe('Bairro'),
  cidade: z.string().describe('Cidade'),
  estado: z.string().describe('Estado'),
})

// Esquemas para orçamentos
export const QuoteRequestSchema = z.object({
  customerName: z
    .string()
    .min(1, 'Nome é obrigatório')
    .describe('Nome do cliente'),
  customerEmail: z
    .string()
    .email('Email inválido')
    .describe('Email do cliente'),
  customerPhone: z.string().describe('Telefone do cliente'),
  cpf: z.string().optional().describe('CPF do cliente'),
  cnpj: z.string().optional().describe('CNPJ da empresa'),
  cep: z.string().optional().describe('CEP do cliente'),
  customerCompany: z.string().optional().describe('Empresa do cliente'),
  message: z.string().optional().describe('Mensagem adicional'),
  deliveryType: z
    .enum(['DELIVERY', 'PICKUP'])
    .optional()
    .describe('Tipo de entrega'),
  deliveryAddress: DeliveryAddressSchema.optional().describe(
    'Endereço de entrega'
  ),
  items: z
    .array(
      z.object({
        equipmentId: z.string().describe('ID do equipamento'),
        quantity: z.number().positive().describe('Quantidade'),
        days: z.number().positive().describe('Dias de locação'),
        startDate: z
          .union([z.string(), z.date()])
          .optional()
          .describe('Data de início da locação'),
        endDate: z
          .union([z.string(), z.date()])
          .optional()
          .describe('Data de fim da locação'),
        includeWeekends: z
          .boolean()
          .optional()
          .describe('Incluir finais de semana na contagem'),
      })
    )
    .min(1, 'Selecione pelo menos um equipamento')
    .describe('Itens do orçamento'),
})

export const CreateAdjustmentSchema = z.object({
  category: z.enum(['LABOR', 'TRAVEL', 'MAINTENANCE', 'OTHER']),
  amount: z.number().finite().positive(),
  justification: z.string().trim().min(3).max(2000),
  sendEmail: z.boolean().optional().default(true),
  sendWhatsapp: z.boolean().optional().default(true),
})

export const ConvertQuoteSchema = z.object({
  generateBoleto: z.boolean().optional().default(false),
  boletoDueDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
})

export const CalculateQuoteLateFeeSchema = z.object({
  currentDate: z.iso.datetime({ offset: true }).optional(),
  config: z
    .object({
      dailyRate: z.number().finite().nonnegative().optional(),
      fixedAmount: z.number().finite().nonnegative().optional(),
      maxDays: z.number().int().positive().optional(),
      minAmount: z.number().finite().nonnegative().optional(),
      maxAmount: z.number().finite().nonnegative().optional(),
    })
    .refine(
      (value) =>
        value.minAmount === undefined ||
        value.maxAmount === undefined ||
        value.minAmount <= value.maxAmount,
      'Intervalo de multa inválido'
    )
    .optional(),
})

export const ContactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').describe('Nome completo'),
  email: z.string().email('Email inválido').describe('Email para contato'),
  phone: z.string().optional().describe('Telefone para contato'),
  cpf: z.string().optional().describe('CPF do cliente'),
  cnpj: z.string().optional().describe('CNPJ da empresa'),
  cep: z.string().optional().describe('CEP do cliente'),
  company: z.string().optional().describe('Empresa/Construtora'),
  equipment: z.string().optional().describe('Equipamento de interesse'),
  message: z.string().min(1, 'Mensagem é obrigatória').describe('Mensagem'),
})

// Tipos customizados para o formulário de contato
// Este arquivo NÃO é auto-gerado pelo Prisma

export type ValidatedContactData = {
  name: string
  email: string
  phone: string
  cep?: string
  company?: string
  equipment?: string
  cpf?: string
  cnpj?: string
  message: string
}
