/**
 * Contrato único da sanitização de HTML, implementado por `sanitize.web.ts`
 * (DOMPurify) e `sanitize.native.ts` (sem DOM: devolve só o texto visível).
 * `isSafeJsonLd` não depende de DOM e é a mesma nas duas plataformas.
 */

/**
 * Tipo para configuração de sanitização (compatível com DOMPurify)
 */
export type SanitizeConfig = {
  ALLOWED_TAGS?: string[]
  ALLOWED_ATTR?: string[]
  ALLOWED_URI_REGEXP?: RegExp
}

export type SanitizeHtml = (_html: string, _config?: SanitizeConfig) => string
export type SanitizeHtmlStrict = (_html: string) => string

/**
 * Valida se uma string JSON é segura para uso em JSON-LD
 * JSON.stringify já é seguro contra XSS, mas esta função valida
 * que o JSON é válido e não contém estruturas perigosas
 *
 * @param json - Objeto a ser validado
 * @returns true se o JSON é seguro
 */
export function isSafeJsonLd(json: unknown): boolean {
  try {
    // JSON.stringify é seguro contra XSS
    // Validar apenas que é um objeto válido
    const stringified = JSON.stringify(json)

    // Verificar que não contém tags script ou javascript:
    if (
      /<script/i.test(stringified) ||
      /javascript:/i.test(stringified) ||
      /on\w+\s*=/i.test(stringified)
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}
