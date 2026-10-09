// Editor dos textos legais no painel (onda 134, lote vitrine-conteúdo, B10). Cada seção é editada como texto na sintaxe
// leve (`entities/documento-legal`: linha em branco separa parágrafos, "- " inicia item, "**Rótulo:**" no começo do item
// vira destaque) e o documento só sai se o contrato aceitar (`StorefrontLegalDocumentSchema`). O id de cada seção é o
// que o documento já tinha; seção nova ganha um pelo título. Funções puras.
import {
  STOREFRONT_LEGAL_DOCUMENT_VERSION,
  StorefrontLegalDocumentSchema,
  type StorefrontLegalDocument,
} from '@gb-locacoes/contracts/storefront-legal'
import {
  blocosParaTexto,
  textoParaBlocos,
} from '../../../entities/documento-legal'

export interface SecaoDoFormulario {
  /** Id da seção (âncora da página); vazio na seção nova. */
  id: string
  titulo: string
  /** Corpo na sintaxe leve. */
  texto: string
  /** Mostra os contatos da locadora no fim da seção. */
  cartao: boolean
  /** Frase opcional do cartão de contato. */
  nota: string
}

export interface FormularioDoTexto {
  lastUpdated: string
  intro: string
  secoes: SecaoDoFormulario[]
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

/** "7 de outubro de 2026" (a forma das datas dos documentos). */
export function dataPorExtenso(data: Date): string {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`
}

const secaoVazia = (): SecaoDoFormulario => ({
  id: '',
  titulo: '',
  texto: '',
  cartao: false,
  nota: '',
})

/** Documento novo: a data do dia e uma seção vazia. */
export function formularioNovo(hoje: Date): FormularioDoTexto {
  return {
    lastUpdated: dataPorExtenso(hoje),
    intro: '',
    secoes: [secaoVazia()],
  }
}

/** Documento publicado → formulário. */
export function formularioDoDocumento(
  documento: StorefrontLegalDocument
): FormularioDoTexto {
  return {
    lastUpdated: documento.lastUpdated,
    intro: documento.intro ?? '',
    secoes: documento.sections.map((section) => ({
      id: section.id,
      titulo: section.title,
      texto: blocosParaTexto(section.blocks),
      cartao: section.contactCard === true,
      nota: section.contactCardNote ?? '',
    })),
  }
}

/** Id pelo título: minúsculas sem acento, palavras unidas por hífen (o formato do contrato). */
function idPeloTitulo(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
  return base || 'secao'
}

/** Formulário → documento validado pelo contrato, ou o motivo de não publicar. */
export function documentoDoFormulario(form: FormularioDoTexto): {
  documento: StorefrontLegalDocument | null
  erro: string | null
} {
  if (
    form.secoes.length === 0 ||
    form.secoes.some(
      (secao) =>
        !secao.titulo.trim() || textoParaBlocos(secao.texto).length === 0
    )
  )
    return { documento: null, erro: 'Cada seção precisa de título e texto.' }
  const usados = new Set(
    form.secoes.map((secao) => secao.id.trim()).filter(Boolean)
  )
  const sections = form.secoes.map((secao) => {
    let id = secao.id.trim()
    if (!id) {
      const base = idPeloTitulo(secao.titulo)
      id = base
      for (let n = 2; usados.has(id); n++) id = `${base}-${n}`
      usados.add(id)
    }
    return {
      id,
      title: secao.titulo.trim(),
      blocks: textoParaBlocos(secao.texto),
      ...(secao.cartao ? { contactCard: true } : {}),
      ...(secao.cartao && secao.nota.trim()
        ? { contactCardNote: secao.nota.trim() }
        : {}),
    }
  })
  const parsed = StorefrontLegalDocumentSchema.safeParse({
    version: STOREFRONT_LEGAL_DOCUMENT_VERSION,
    lastUpdated: form.lastUpdated.trim(),
    ...(form.intro.trim() ? { intro: form.intro.trim() } : {}),
    sections,
  })
  return parsed.success
    ? { documento: parsed.data, erro: null }
    : {
        documento: null,
        erro: 'O documento não está no formato aceito: confira os tamanhos e os caracteres de cada campo.',
      }
}

/** Sobe (-1) ou desce (+1) uma seção; fora dos limites, o mesmo formulário. */
export function moverSecao(
  form: FormularioDoTexto,
  indice: number,
  direcao: -1 | 1
): FormularioDoTexto {
  const destino = indice + direcao
  if (destino < 0 || destino >= form.secoes.length) return form
  const secoes = [...form.secoes]
  const [secao] = secoes.splice(indice, 1)
  secoes.splice(destino, 0, secao!)
  return { ...form, secoes }
}

/** Seção vazia no fim do formulário. */
export function comNovaSecao(form: FormularioDoTexto): FormularioDoTexto {
  return { ...form, secoes: [...form.secoes, secaoVazia()] }
}
