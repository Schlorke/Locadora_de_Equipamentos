// Linha da identificação legal da locadora na vitrine (achado 147; Decreto 7.962/2013, art. 2º, I): o CNPJ e, quando
// difere do nome do cartão, o nome empresarial. Função pura; sem dado, sem linha (nunca o CNPJ de outra locadora).
import type { PublicLegalIdentity } from '@gb-locacoes/contracts/settings'

const comparavel = (texto: string) =>
  texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')

/**
 * "CNPJ: 00.000.000/0000-00"; com nome empresarial diferente do nome da vitrine, "<nome empresarial> · CNPJ: …"; só o
 * nome empresarial quando não há CNPJ. `null` sem nenhum dos dois.
 */
export function linhaLegal(
  identificacao: PublicLegalIdentity | null | undefined,
  nomeDaVitrine: string | null | undefined
): string | null {
  const cnpj = identificacao?.cnpj ?? null
  const razao = identificacao?.legalName?.trim() || null
  const razaoVisivel =
    razao && (!nomeDaVitrine || comparavel(razao) !== comparavel(nomeDaVitrine))
      ? razao
      : null
  if (cnpj)
    return razaoVisivel ? `${razaoVisivel} · CNPJ: ${cnpj}` : `CNPJ: ${cnpj}`
  return razaoVisivel
}
