/**
 * Caracteres de máscara aceitos na digitação de CPF e CNPJ: ponto, barra,
 * hífen e espaços. São os únicos removidos na normalização.
 */
const MASCARA = /[./\-\s]/g

/** Só letras ASCII minúsculas viram maiúsculas; nenhum outro caractere muda. */
const MINUSCULA_ASCII = /[a-z]/g

/**
 * Normaliza um CPF ou CNPJ digitado: tira a máscara (`.`, `/`, `-` e espaços)
 * e passa as letras ASCII para maiúsculas.
 *
 * **Não apaga letras nem outros caracteres.** O CNPJ alfanumérico (Receita
 * Federal, a partir de julho de 2026) usa letras nas 12 primeiras posições, e
 * o antigo `replace(/\D/g, '')` as destruía. Um caractere que não é máscara
 * (letra num CPF, `_`, `#`, acento) continua no resultado e faz a validação
 * recusar o documento, em vez de ser descartado em silêncio.
 *
 * A conversão para maiúsculas é só de `a-z`: `toUpperCase()` transformaria,
 * por exemplo, `ß` em `SS` e aceitaria um documento que não foi digitado.
 */
export function normalizarDocumento(valor: string): string {
  return valor
    .replace(MASCARA, '')
    .replace(MINUSCULA_ASCII, (letra) => letra.toUpperCase())
}

/** Verdadeiro quando todos os caracteres são iguais (`00000000000000`, `11111111111`). */
export function todosCaracteresIguais(valor: string): boolean {
  return valor.length > 0 && valor.split('').every((c) => c === valor[0])
}
