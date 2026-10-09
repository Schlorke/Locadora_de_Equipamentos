/**
 * Utilitário de Sanitização HTML
 *
 * Fornece funções para sanitizar HTML e prevenir ataques XSS usando
 * isomorphic-dompurify (DOMPurify em SSR via jsdom e no client via DOM real).
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Tipo para configuração de sanitização (compatível com DOMPurify)
 */
type SanitizeConfig = {
  ALLOWED_TAGS?: string[]
  ALLOWED_ATTR?: string[]
  ALLOWED_URI_REGEXP?: RegExp
}

/**
 * Configuração padrão para sanitização de HTML de conteúdo
 * Permite tags comuns de formatação e links
 */
const DEFAULT_SANITIZE_CONFIG: SanitizeConfig = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'a',
    'img',
    'div',
    'span',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
}

/** Remove scripts e atributos perigosos; em SSR não temos DOM, então fazemos strip seguro. */
function sanitizeHtmlServer(html: string): string {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/\s on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '')
}

/**
 * Sanitiza HTML para prevenir ataques XSS
 *
 * Usa isomorphic-dompurify (SSR + client). Em ambientes sem DOM (ex.: Edge)
 * faz fallback para sanitização por regex.
 *
 * @param html - HTML a ser sanitizado
 * @param config - Configuração opcional de sanitização (usa padrão se não fornecido)
 * @returns HTML sanitizado e seguro
 *
 * @example
 * ```tsx
 * const safeHtml = sanitizeHtml(userInput)
 * <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
 * ```
 */
export function sanitizeHtml(
  html: string,
  config?: typeof DEFAULT_SANITIZE_CONFIG
): string {
  if (typeof html !== 'string') return ''

  try {
    const sanitizeConfig = config || DEFAULT_SANITIZE_CONFIG
    const sanitized = DOMPurify.sanitize(html, sanitizeConfig)
    return typeof sanitized === 'string' ? sanitized : String(sanitized)
  } catch {
    return sanitizeHtmlServer(html)
  }
}

/** Converte texto puro para HTML preservando quebras de linha */
export function plainTextToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>\n')
}
