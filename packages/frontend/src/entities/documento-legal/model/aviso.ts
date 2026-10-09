// Aviso das páginas legais quando o documento da locadora não pode ser mostrado (onda 134, lote vitrine-conteúdo). A
// mesma frase na web e no app; publicado não tem aviso.
import type { EstadoDoDocumentoLegal } from '../api/use-documento-legal'

export function avisoDoDocumentoLegal(
  estado: EstadoDoDocumentoLegal
): string | null {
  switch (estado.status) {
    case 'publicado':
      return null
    case 'ausente':
      return 'Esta locadora ainda não publicou este documento.'
    case 'versao-nao-suportada':
      return 'Atualize o aplicativo para ler este documento.'
    case 'erro':
      return 'Não foi possível carregar este documento. Tente novamente mais tarde.'
    case 'carregando':
      return 'Carregando documento...'
  }
}
