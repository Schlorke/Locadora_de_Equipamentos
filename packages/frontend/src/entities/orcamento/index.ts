export { buildQuotePricing } from './model/preco'
export { createClientQuoteApi } from './api/client-quotes'
export type { ClientQuote, ClientQuoteAddress } from './api/client-quotes'
export type { ClientQuoteDetail } from './api/client-quote-detail'
export type { EquipmentPricingInput } from './model/preco'
export { calculateFreight, calculateFreightWithAPI } from './model/frete'
export type {
  FreightCalculationRequest,
  FreightCalculationResult,
  FreightOption,
} from './model/frete'
export {
  ADJUSTMENT_CATEGORY_LABELS,
  formatAdjustmentReason,
  parseAdjustmentBlocks,
} from './model/reajuste'
export { DEFAULT_LATE_FEE_CONFIG, calculateLateFee } from './model/multa'
export type { LateFeeConfig, LateFeeResult } from './model/multa'
export {
  QUOTE_ADDRESS_REQUIRED,
  QUOTE_CNPJ_INVALID,
  QUOTE_COMPANY_REQUIRED,
  QUOTE_CPF_INVALID,
  QUOTE_DELIVERY_TYPE_REQUIRED,
  QUOTE_DOCUMENT_REQUIRED,
  QUOTE_PERIOD_REQUIRED,
  QUOTE_UNAVAILABLE,
  assessQuoteSubmit,
  buildQuoteRequestBody,
  collectNewCustomerInfo,
  isDocumentValueNew,
  findItemNeedingWeekendConfirmation,
  isAddressComplete,
  isAddressDifferent,
  listMissingQuoteFields,
  missingAddressFieldsMessage,
  missingQuoteFieldsMessage,
  weekendConfirmationMessage,
} from './model/envio'
export {
  convertFormDataToWhatsApp,
  formatPhoneForWhatsApp,
  formatWhatsAppMessage,
  generateWhatsAppURL,
  openWhatsAppQuote,
} from './model/whatsapp'
export type { WhatsAppQuoteData } from './model/whatsapp'
export {
  formatAddress,
  formatDocument,
  validateCNPJ,
  validateCPF,
} from './model/documento'
export type {
  QuoteRequestAddress,
  QuoteRequestForm,
  QuoteRequestItemInput,
  QuoteSubmitIssue,
  SavedQuoteAddress,
} from './model/envio'
export {
  ADJUSTMENT_CATEGORY_LABEL,
  createDefaultAdjustmentItem,
  statusConfig,
} from './model/registro'
export type {
  PriceAdjustmentItem,
  Quote,
  QuoteAdjustmentFromApi,
  QuotePayment,
  QuotePaymentMetadata,
  QuotePaymentTerms,
} from './model/registro'
export {
  countDaysBetween,
  findFirstMonthWithQuotes,
  formatCNPJInput,
  formatCPFInput,
  formatDate,
  formatPaymentStatus,
  getBoletoPayment,
  getBoletoStatusBadgeClassName,
  getCardStatusBadge,
  getQuoteReferenceDate,
  hasQuotesInMonth,
  normalizeQuote,
  normalizeStatus,
  parseLocalDate,
} from './model/registro-utils'
