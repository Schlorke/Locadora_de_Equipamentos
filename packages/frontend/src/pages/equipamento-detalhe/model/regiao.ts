// Região de entrega no detalhe do equipamento (web e native): a cidade do cartão público da própria locadora; sem
// ela, texto neutro. Nunca a região de outra locadora (o texto fixo trazia a cidade da GB; achado 143). A entrega no
// mesmo dia é compromisso da locadora (onda 134): mora em entities/configuracao/model/compromissos.ts.

const cidadeDe = (cidade: string | null | undefined) => cidade?.trim() || null

/** Linha do bloco de preço. */
export function entregaNaRegiao(cidade: string | null | undefined): string {
  const nome = cidadeDe(cidade)
  return nome ? `Entrega em ${nome} e região` : 'Entrega na região'
}
