/**
 * Sanitização HTML: contrato em `sanitize-contract.ts`, implementação web
 * (DOMPurify) em `sanitize.web.ts` e nativa (texto puro, sem DOM) em
 * `sanitize.native.ts`. No app nativo, `./sanitize` resolve para a variante
 * nativa; este arquivo universal só aponta para a web.
 */
export {
  isSafeJsonLd,
  sanitizeHtml,
  sanitizeHtmlStrict,
  type SanitizeConfig,
} from './sanitize.web'
