export { normalizarDocumento } from './normalizacao'
export {
  FORMATO_CPF,
  calcularDigitosCpf,
  formatarCpf,
  normalizarCpf,
  validarCpf,
} from './cpf'
export {
  FORMATO_CNPJ,
  calcularDigitosCnpj,
  formatarCnpj,
  normalizarCnpj,
  validarCnpj,
  valorDoCaractereCnpj,
} from './cnpj'
export { formatarDocumento, identificarDocumento } from './tipo'
export type { DocumentoIdentificado, TipoDeDocumento } from './tipo'
