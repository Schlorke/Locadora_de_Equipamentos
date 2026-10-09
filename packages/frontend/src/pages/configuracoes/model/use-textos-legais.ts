'use client'
// Estado dos textos legais no painel (onda 134, lote vitrine-conteúdo, B10): lê os três documentos da locadora
// selecionada, mantém um formulário por documento, publica (substitui a versão anterior; o painel avisa) e despublica.
// Sem os Termos publicados, o pedido de orçamento segue sem a caixa de aceite (D-C, parte 1); sem a Privacidade, o site
// fica sem a página de privacidade: o painel avisa os dois.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  STOREFRONT_LEGAL_KINDS,
  type StorefrontLegalDocument,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { createTextosLegaisApi } from '../api/textos-legais'
import {
  documentoDoFormulario,
  formularioDoDocumento,
  formularioNovo,
  type FormularioDoTexto,
} from './textos-legais'

export interface EstadoDoTexto {
  readonly carregado: boolean
  readonly documento: StorefrontLegalDocument | null
  readonly publicadoEm: string | null
  readonly erro: string | null
}

export const NOMES_DOS_TEXTOS: Readonly<Record<StorefrontLegalKind, string>> = {
  terms: 'Termos e Condições de Uso',
  privacy: 'Política de Privacidade',
  returnPolicy: 'Política de Devolução',
}

/** Avisos de sucesso com a concordância de cada nome ("Termos … publicados", "Política … publicada"). */
const AVISOS_DOS_TEXTOS: Readonly<
  Record<StorefrontLegalKind, { publicado: string; retirado: string }>
> = {
  terms: {
    publicado: 'Termos e Condições de Uso publicados no site.',
    retirado: 'Termos e Condições de Uso retirados do site.',
  },
  privacy: {
    publicado: 'Política de Privacidade publicada no site.',
    retirado: 'Política de Privacidade retirada do site.',
  },
  returnPolicy: {
    publicado: 'Política de Devolução publicada no site.',
    retirado: 'Política de Devolução retirada do site.',
  },
}

const INICIAL: EstadoDoTexto = {
  carregado: false,
  documento: null,
  publicadoEm: null,
  erro: null,
}

const porTipo = <T>(valor: (kind: StorefrontLegalKind) => T) =>
  Object.fromEntries(
    STOREFRONT_LEGAL_KINDS.map((kind) => [kind, valor(kind)])
  ) as Record<StorefrontLegalKind, T>

export function useTextosLegais({
  hoje: hojeInicial = () => new Date(),
}: { hoje?: () => Date } = {}) {
  // A data do dia (documento novo) fica fixa no primeiro render: a leitura não roda de novo a cada render.
  const [hoje] = useState(() => hojeInicial)
  const client = useScopedApiClient(null)
  const api = useMemo(() => createTextosLegaisApi(client), [client])
  const [estados, setEstados] = useState(() => porTipo(() => INICIAL))
  const [formularios, setFormularios] = useState(() =>
    porTipo(() => formularioNovo(hoje()))
  )
  const [ocupado, setOcupado] = useState<StorefrontLegalKind | null>(null)

  const aplicar = useCallback(
    (
      kind: StorefrontLegalKind,
      documento: StorefrontLegalDocument | null,
      publicadoEm: string | null
    ) => {
      setEstados((atual) => ({
        ...atual,
        [kind]: { carregado: true, documento, publicadoEm, erro: null },
      }))
      setFormularios((atual) => ({
        ...atual,
        [kind]: documento
          ? formularioDoDocumento(documento)
          : formularioNovo(hoje()),
      }))
    },
    [hoje]
  )

  useEffect(() => {
    for (const kind of STOREFRONT_LEGAL_KINDS)
      void api.ler(kind).then(
        (resultado) => {
          if (!client.isCurrent()) return
          if (resultado.ok)
            aplicar(kind, resultado.documento, resultado.publicadoEm)
          else
            setEstados((atual) => ({
              ...atual,
              [kind]: { ...INICIAL, carregado: true, erro: resultado.erro },
            }))
        },
        (error: unknown) => {
          if (isAbortError(error) || !client.isCurrent()) return
          setEstados((atual) => ({
            ...atual,
            [kind]: {
              ...INICIAL,
              carregado: true,
              erro: 'Não foi possível carregar o documento.',
            },
          }))
        }
      )
  }, [api, client, aplicar])

  const editar = (kind: StorefrontLegalKind, form: FormularioDoTexto) =>
    setFormularios((atual) => ({ ...atual, [kind]: form }))

  async function executar(
    kind: StorefrontLegalKind,
    acao: () => ReturnType<typeof api.publicar>,
    sucesso: string
  ) {
    setOcupado(kind)
    try {
      const resultado = await acao()
      if (!client.isCurrent()) return false
      if (!resultado.ok) {
        toast.error('Erro', { description: resultado.erro })
        return false
      }
      aplicar(kind, resultado.documento, resultado.publicadoEm)
      toast.success('Sucesso!', { description: sucesso })
      return true
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return false
      toast.error('Erro', {
        description: 'Não foi possível concluir a operação. Tente novamente.',
      })
      return false
    } finally {
      if (client.isCurrent()) setOcupado(null)
    }
  }

  const publicar = async (kind: StorefrontLegalKind) => {
    const { documento, erro } = documentoDoFormulario(formularios[kind])
    if (!documento) {
      toast.error('Erro', { description: erro ?? 'Documento inválido.' })
      return false
    }
    return executar(
      kind,
      () => api.publicar(kind, documento),
      AVISOS_DOS_TEXTOS[kind].publicado
    )
  }

  const despublicar = (kind: StorefrontLegalKind) =>
    executar(
      kind,
      () => api.despublicar(kind),
      AVISOS_DOS_TEXTOS[kind].retirado
    )

  const carregados = STOREFRONT_LEGAL_KINDS.every(
    (kind) => estados[kind].carregado && !estados[kind].erro
  )
  return {
    estados,
    formularios,
    ocupado,
    editar,
    publicar,
    despublicar,
    /** Avisos do painel: Termos e Privacidade ausentes (só depois da leitura dos três). */
    faltamTermos: carregados && !estados.terms.documento,
    faltaPrivacidade: carregados && !estados.privacy.documento,
  }
}
