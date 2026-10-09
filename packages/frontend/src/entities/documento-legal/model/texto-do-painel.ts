// Sintaxe leve do editor de textos legais do painel (onda 134, lote vitrine-conteúdo), de ida e volta com os blocos do
// contrato (`@gb-locacoes/contracts/storefront-legal`). Uma seção é um texto:
// - linha em branco separa parágrafos e listas;
// - linhas seguidas viram um parágrafo só, unidas por espaço;
// - "- " no começo da linha é um item de lista (itens seguidos formam uma lista);
// - "**Rótulo:**" no começo do item é o destaque (`lead`), e o resto da linha, o texto do item.
// Escapes: "\" no começo de um parágrafo ou de um item tira o significado do que vem depois ("\- " é parágrafo que começa
// com hífen, "\**" é item que começa com asteriscos); dentro do destaque, "\*" e "\\" são o asterisco e a barra.
// Função pura: nunca produz HTML nem link; o texto continua texto.
import type {
  StorefrontLegalBlock,
  StorefrontLegalListItem,
} from '@gb-locacoes/contracts/storefront-legal'

const ITEM = /^- /
const BARRA = '\\'

const escaparInicio = (texto: string, perigo: (valor: string) => boolean) =>
  texto.startsWith(BARRA) || perigo(texto) ? BARRA + texto : texto

const escaparDestaque = (texto: string) =>
  texto.replaceAll(BARRA, BARRA + BARRA).replaceAll('*', BARRA + '*')

function itemParaLinha(item: StorefrontLegalListItem): string {
  if (typeof item === 'string')
    return '- ' + escaparInicio(item, (valor) => valor.startsWith('**'))
  return (
    '- **' +
    escaparDestaque(item.lead) +
    '**' +
    (item.text === '' ? '' : ' ' + item.text)
  )
}

/** Blocos de uma seção no texto do editor. */
export function blocosParaTexto(
  blocos: readonly StorefrontLegalBlock[]
): string {
  return blocos
    .map((bloco) =>
      bloco.type === 'paragraph'
        ? escaparInicio(bloco.text, (valor) => ITEM.test(valor))
        : bloco.items.map(itemParaLinha).join('\n')
    )
    .join('\n\n')
}

/** Destaque entre "**" com os escapes; `null` sem o fechamento. */
function lerDestaque(linha: string): { lead: string; resto: string } | null {
  let lead = ''
  for (let index = 2; index < linha.length; index++) {
    const caractere = linha[index]!
    if (caractere === BARRA && index + 1 < linha.length) {
      lead += linha[index + 1]
      index++
      continue
    }
    if (caractere === '*' && linha[index + 1] === '*')
      return { lead, resto: linha.slice(index + 2) }
    lead += caractere
  }
  return null
}

function linhaParaItem(conteudo: string): StorefrontLegalListItem {
  if (conteudo.startsWith(BARRA)) return conteudo.slice(1)
  if (conteudo.startsWith('**')) {
    const destaque = lerDestaque(conteudo)
    if (destaque && destaque.lead.trim() !== '')
      return {
        lead: destaque.lead.trim(),
        text: destaque.resto.trim(),
      }
  }
  return conteudo
}

/** Texto do editor em blocos (parágrafos e listas), na ordem. Linhas em branco a mais não contam. */
export function textoParaBlocos(texto: string): StorefrontLegalBlock[] {
  const blocos: StorefrontLegalBlock[] = []
  let paragrafo: string[] = []
  let lista: StorefrontLegalListItem[] | null = null
  const fecharParagrafo = () => {
    if (paragrafo.length > 0) {
      const linha = paragrafo.join(' ')
      blocos.push({
        type: 'paragraph',
        text: linha.startsWith(BARRA) ? linha.slice(1) : linha,
      })
    }
    paragrafo = []
  }
  const fecharLista = () => {
    if (lista && lista.length > 0) blocos.push({ type: 'list', items: lista })
    lista = null
  }
  for (const bruta of texto.replaceAll('\r\n', '\n').split('\n')) {
    const linha = bruta.trim()
    if (linha === '') {
      fecharParagrafo()
      fecharLista()
      continue
    }
    if (ITEM.test(linha)) {
      fecharParagrafo()
      lista ??= []
      lista.push(linhaParaItem(linha.slice(2).trim()))
      continue
    }
    fecharLista()
    paragrafo.push(linha)
  }
  fecharParagrafo()
  fecharLista()
  return blocos
}
