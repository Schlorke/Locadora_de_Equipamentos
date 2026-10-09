/**
 * TypeScript interfaces for the Ofício (Billing Report) PDF generation.
 */

export interface OficioCompanyInfo {
  razaoSocial: string
  cnpj: string
  endereco: string
  cidade: string
  estado: string
  telefone: string
  email: string
  website: string
}

export interface OficioClientInfo {
  codigo: string // quoteCode or legacyExternalCode
  razaoSocial: string // company or client name
  documento: string // CPF/CNPJ formatted
  tipoDocumento: 'CPF' | 'CNPJ' | 'CNI'
  obra: string
  mesReferencia: string // month name pt-BR
  anoReferencia: string // yyyy
  contato: string // phone + email
  forma: string // payment terms translated
  aprovacao: string // approval date or '-'
  fatura: string // invoice number or '-'
  boleto: string // boleto ID or '-'
  endereco: string // delivery address
  enderecoCobranca: string // billing address
  nota: string // invoice number or '-'
  cei: string
  im: string
  ie: string
}

export interface OficioRentalItem {
  index: number
  equipamento: string
  inicio: string // dd/MM/yy
  fim: string // dd/MM/yy
  quantidade: number
  dias: number
  valor: number // total in BRL
  situacao: string // status translated
}

export interface OficioServiceItem {
  index: number
  servico: string // service name or category label
  data: string // dd/MM/yy
  descricao: string // justification
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export interface OficioFinancialSummary {
  bruto: number
  locacao: number
  servicos: number
  retencaoTotal: number
  retencaoTotalPercent: number
  retencaoLocacao: number
  retencaoLocacaoPercent: number
  retencaoServicos: number
  retencaoServicosPercent: number
  liquido: number
}

export interface OficioData {
  empresa: OficioCompanyInfo
  cliente: OficioClientInfo
  itensLocacao: OficioRentalItem[]
  itensServico: OficioServiceItem[]
  resumo: OficioFinancialSummary
  observacoes: string
  preview: boolean // if true, add "PRÉVIA" watermark
  geradoEm: string // formatted generation timestamp
}
