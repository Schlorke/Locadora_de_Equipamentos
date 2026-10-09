import {
  anos,
  beneficiosComCompromisso,
  comCompromissosDeclarados,
  compromissosDeclarados,
  numeroDaVitrine,
} from '../../../entities/configuracao'
import type { SiteContent } from '@gb-locacoes/contracts/settings'

/** Chave de cada benefício; o ícone e a cor ficam na variante web (`ui/PorQueEscolher.web.tsx`). */
export type ChaveDoBeneficio =
  | 'certificados'
  | 'entrega'
  | 'atendimento'
  | 'construtoras'
  | 'anos'
  | 'rastreamento'

export interface Beneficio {
  chave: ChaveDoBeneficio
  title: string
  description: string
}

/** Conteúdo institucional que a seção lê (compromissos, construtoras clientes e anos de mercado). */
export type ConteudoDosBeneficios = Pick<
  SiteContent,
  'commitments' | 'featuredClients' | 'experienceYears'
>

/**
 * Benefícios da seção "Por que escolher" (achado 143; onda 134), na ordem de 55763c1e: certificados, entrega,
 * atendimento, construtoras, anos de mercado e rastreamento. Cada cartão aparece só com o dado da própria locadora: os
 * de compromisso só com os compromissos declarados (regra E; frases em `entities/configuracao/model/compromissos.ts`),
 * o das construtoras só com a lista dela e o dos anos só com o número dela. "Atendimento Especializado" é declaração de
 * valor do modelo e fica sempre.
 */
export function beneficiosDaLocadora(
  cidade: string | null,
  conteudo?: ConteudoDosBeneficios | null
): Beneficio[] {
  const declarados = compromissosDeclarados(conteudo)
  const deCompromisso = new Map(
    comCompromissosDeclarados(declarados, beneficiosComCompromisso(cidade)).map(
      (cartao) => [cartao.chave, cartao] as const
    )
  )
  const doCompromisso = (
    chave: 'certificados' | 'entrega' | 'rastreamento'
  ) => {
    const cartao = deCompromisso.get(chave)
    return cartao
      ? [{ chave, title: cartao.titulo, description: cartao.descricao }]
      : []
  }
  const construtoras = conteudo?.featuredClients ?? []
  const anosDeMercado = conteudo?.experienceYears
  return [
    ...doCompromisso('certificados'),
    ...doCompromisso('entrega'),
    {
      chave: 'atendimento',
      title: 'Atendimento Especializado',
      description:
        'Atendimento personalizado com profissionais experientes em equipamentos para obras e serviços em altura.',
    },
    ...(construtoras.length > 0
      ? [
          {
            chave: 'construtoras' as const,
            title: 'Parceira de Grandes Construtoras',
            description: `Atendemos grandes construtoras como ${construtoras.join(', ')} e outras.`,
          },
        ]
      : []),
    ...(anosDeMercado
      ? [
          {
            chave: 'anos' as const,
            title: `${numeroDaVitrine(anosDeMercado)} ${anosDeMercado === 1 ? 'Ano' : 'Anos'} de Experiência`,
            description: `Há ${anos(anosDeMercado)} oferecendo soluções em locação de equipamentos com foco em segurança, qualidade e comprometimento.`,
          },
        ]
      : []),
    ...doCompromisso('rastreamento'),
  ]
}
