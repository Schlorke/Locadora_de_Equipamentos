// Números do conteúdo institucional da própria locadora em texto da vitrine (onda 134, lote vitrine-conteúdo). Funções
// puras: o modelo só escreve o número que a locadora declarou no painel (`settings.siteContent`); sem o número, o bloco
// não aparece (quem chama decide).

/** Inteiro com o separador de milhar do pt-BR ("1.200"), sem depender do Intl do aparelho. */
export function numeroDaVitrine(valor: number): string {
  return String(Math.trunc(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** "N+", como "1.200+" (números da Sobre e do contato). */
export function comMais(valor: number): string {
  return `${numeroDaVitrine(valor)}+`
}

/** "+N", como "+1.200" (selos do hero e da Sobre). */
export function maisAntes(valor: number): string {
  return `+${numeroDaVitrine(valor)}`
}

/** "1 ano", "12 anos". */
export function anos(valor: number): string {
  return valor === 1 ? '1 ano' : `${numeroDaVitrine(valor)} anos`
}

/** "Mais de uma década" a partir de 10 anos (a redação da produção); abaixo, "Há N anos". */
export function decadas(valor: number): string {
  return valor >= 10 ? 'Mais de uma década' : `Há ${anos(valor)}`
}
