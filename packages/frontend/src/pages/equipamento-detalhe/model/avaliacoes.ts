// Conteúdo institucional que o detalhe do equipamento mostra (web e app; onda 134): a nota de avaliações com a fonte
// (decisão D-A: sem fonte, nenhuma nota; nunca no JSON-LD) e os anos de mercado. Só com o dado da própria locadora.
import type { SiteContent } from '@gb-locacoes/contracts/settings'
import { anos, numeroDaVitrine } from '../../../entities/configuracao'

export interface NotaDaLocadora {
  /** Nota com uma casa decimal (ponto como separador), como a produção mostrava. */
  readonly nota: string
  /** Estrelas cheias (a nota arredondada); as demais ficam vazias. */
  readonly estrelasCheias: number
  /** Quantidade com a palavra no singular ou no plural ("1 avaliação"). */
  readonly quantidade: string
  readonly fonte: string
  readonly url: string
}

/** A nota que a locadora declarou no painel, com a fonte; sem ela, `null`. */
export function notaDaLocadora(
  conteudo: Pick<SiteContent, 'reviews'> | null | undefined
): NotaDaLocadora | null {
  const avaliacoes = conteudo?.reviews
  if (!avaliacoes) return null
  return {
    nota: avaliacoes.rating.toFixed(1),
    estrelasCheias: Math.round(avaliacoes.rating),
    quantidade:
      avaliacoes.count === 1
        ? '1 avaliação'
        : `${numeroDaVitrine(avaliacoes.count)} avaliações`,
    fonte: avaliacoes.sourceName,
    url: avaliacoes.sourceUrl,
  }
}

/** Subtítulo do "Por que escolher" do detalhe (a redação da produção), só com os anos da locadora. */
export function anosNoMercado(
  experienceYears: number | null | undefined
): string | null {
  return experienceYears
    ? `Mais de ${anos(experienceYears)} de experiência no mercado`
    : null
}
