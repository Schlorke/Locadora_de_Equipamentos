// Compromissos comerciais do modelo de site (onda 134, lote vitrine-conteúdo; §2.3 do plano e decisão do dono D-E de
// 2026-10-07). Cada frase do modelo que afirma uma condição de serviço verificável (gratuidade, prazo, 24 horas,
// certificação, logística, rastreamento, resposta) só aparece quando a própria locadora declarou, no painel, todos os
// compromissos a que a frase está ligada (E lógico: a frase nunca sai pela metade). Desligados por padrão (CDC art. 30:
// a oferta obriga quem a faz). As frases moram só aqui: tests/unit/compromissos-do-modelo.test.ts recusa cópia delas
// em qualquer outro arquivo da vitrine, do painel e do app. Declarações de valor sem condição verificável ("Atendimento
// Especializado", "Nossos Valores" da Sobre, "Orçamento Grátis") ficam no modelo.
import {
  SITE_CONTENT_COMMITMENTS,
  type SiteContent,
  type SiteContentCommitment,
} from '@gb-locacoes/contracts/settings'

export type Compromisso = SiteContentCommitment
export type CompromissosDeclarados = Readonly<Record<Compromisso, boolean>>

/** O que a locadora afirma ao ligar cada compromisso (texto do painel, seção "O que você garante aos clientes"). */
export const COMPROMISSOS: Readonly<Record<Compromisso, string>> = {
  certifiedEquipment:
    'Equipamentos com certificação de segurança e manutenção preventiva',
  freeDelivery: 'Entrega e retirada incluídas na locação, sem custo',
  fastDelivery: 'Entrega rápida',
  sameDayDelivery: 'Entrega no mesmo dia na região',
  ownLogistics: 'Logística própria',
  equipmentTracking:
    'Rastreamento dos equipamentos (onde estão e a última manutenção)',
  support24h: 'Suporte técnico 24 horas',
  flexibleScheduling: 'Entrega e coleta no horário do cliente',
  freeConsulting: 'Consultoria gratuita',
  responseWithin24h: 'Resposta ao e-mail em até 24 horas',
  fastResponseGuaranteed: 'Resposta rápida garantida',
}

/** Compromissos que a locadora declarou: só `true` vale; ausente, inválido ou `false` fica desligado (D-E). */
export function compromissosDeclarados(
  conteudo?: Pick<SiteContent, 'commitments'> | null
): CompromissosDeclarados {
  const declarados = conteudo?.commitments
  return Object.fromEntries(
    SITE_CONTENT_COMMITMENTS.map((chave) => [
      chave,
      declarados?.[chave] === true,
    ])
  ) as Record<Compromisso, boolean>
}

/** Regra E: o elemento aparece só com todos os compromissos dele declarados. */
export function declarouTodos(
  declarados: CompromissosDeclarados,
  requer: readonly Compromisso[]
): boolean {
  return requer.length > 0 && requer.every((chave) => declarados[chave])
}

/** Os elementos de uma lista cujos compromissos a locadora declarou, na ordem do modelo. */
export function comCompromissosDeclarados<
  T extends { readonly requer: readonly Compromisso[] },
>(declarados: CompromissosDeclarados, elementos: readonly T[]): T[] {
  return elementos.filter((elemento) =>
    declarouTodos(declarados, elemento.requer)
  )
}

export interface FraseDeCompromisso {
  readonly chave: string
  readonly texto: string
  readonly requer: readonly Compromisso[]
}

export interface CartaoDeCompromisso {
  readonly chave: string
  readonly titulo: string
  readonly descricao: string
  readonly requer: readonly Compromisso[]
}

const regiaoDe = (cidade: string | null | undefined) => cidade?.trim() || null

/** Linha do topo do detalhe do equipamento (web e app, a mesma lista). */
export const DETALHE_TOPO: readonly FraseDeCompromisso[] = [
  {
    chave: 'certificado',
    texto: 'Equipamento Certificado',
    requer: ['certifiedEquipment'],
  },
  { chave: 'entrega', texto: 'Entrega Gratuita', requer: ['freeDelivery'] },
  { chave: 'suporte', texto: 'Suporte Garantido', requer: ['support24h'] },
]

/** "Incluído na locação" do detalhe; sem item, o título sai junto. */
export const DETALHE_INCLUIDO: readonly FraseDeCompromisso[] = [
  {
    chave: 'manutencao',
    texto: 'Manutenção preventiva',
    requer: ['certifiedEquipment'],
  },
  { chave: 'suporte', texto: 'Suporte técnico 24h', requer: ['support24h'] },
  { chave: 'entrega', texto: 'Entrega e retirada', requer: ['freeDelivery'] },
]

/** Entrega no mesmo dia na região da própria locadora (cidade do cartão; sem ela, texto neutro). */
export function entregaNoMesmoDia(cidade: string | null | undefined): string {
  const nome = regiaoDe(cidade)
  return nome
    ? `Entrega no mesmo dia para região metropolitana de ${nome}`
    : 'Entrega no mesmo dia na região metropolitana'
}

/** "Por que escolher" do detalhe do equipamento; sem cartão, o bloco sai. */
export function detalhePorQueEscolher(
  cidade: string | null | undefined
): CartaoDeCompromisso[] {
  return [
    {
      chave: 'certificados',
      titulo: 'Equipamentos Certificados',
      descricao:
        'Todos os equipamentos passam por rigorosa inspeção e possuem certificações de segurança',
      requer: ['certifiedEquipment'],
    },
    {
      chave: 'entrega',
      titulo: 'Entrega Rápida',
      descricao: entregaNoMesmoDia(cidade),
      requer: ['fastDelivery', 'sameDayDelivery'],
    },
    {
      chave: 'suporte',
      titulo: 'Suporte 24h',
      descricao:
        'Equipe técnica disponível 24 horas para suporte e emergências',
      requer: ['support24h'],
    },
  ]
}

/** Cartões de compromisso do "Por que escolher" da home (os de valor e os de dado ficam no widget). */
export function beneficiosComCompromisso(
  cidade: string | null | undefined
): CartaoDeCompromisso[] {
  const regiao = regiaoDe(cidade)
  return [
    {
      chave: 'certificados',
      titulo: 'Equipamentos Certificados',
      descricao:
        'Todos os nossos equipamentos possuem certificação e passam por manutenção preventiva constante para garantir segurança total.',
      requer: ['certifiedEquipment'],
    },
    {
      chave: 'entrega',
      titulo: 'Entrega Rápida e Eficiente',
      descricao: `Entregamos em toda ${regiao ? `região de ${regiao}` : 'a região'} com logística própria e rastreamento dos equipamentos em tempo real.`,
      requer: ['fastDelivery', 'ownLogistics', 'equipmentTracking'],
    },
    {
      chave: 'rastreamento',
      titulo: 'Rastreamento dos Equipamentos',
      descricao:
        'Sistema de rastreamento que identifica onde cada equipamento está e quando foi feita a última manutenção.',
      requer: ['equipmentTracking'],
    },
  ]
}

/** Serviços da página de contato ligados a compromisso ("Atendimento Especializado" é declaração de valor). */
export const SERVICOS_DO_CONTATO: readonly CartaoDeCompromisso[] = [
  {
    chave: 'agendamento',
    titulo: 'Agendamento Flexível',
    descricao: 'Entrega e coleta nos horários que funcionam para você',
    requer: ['flexibleScheduling'],
  },
  {
    chave: 'qualidade',
    titulo: 'Qualidade Garantida',
    descricao: 'Equipamentos revisados e com certificação de segurança',
    requer: ['certifiedEquipment'],
  },
]

/** Selos do cartão "Atendimento Especializado" da página de contato; sem selo, a fileira sai. */
export const SELOS_DO_CONTATO: readonly FraseDeCompromisso[] = [
  {
    chave: 'consultoria',
    texto: 'Consultoria Gratuita',
    requer: ['freeConsulting'],
  },
  { chave: 'entrega', texto: 'Entrega Rápida', requer: ['fastDelivery'] },
  { chave: 'suporte', texto: 'Suporte 24h', requer: ['support24h'] },
]

/** Número "24h" do topo da página de contato. */
export const SUPORTE_NOS_NUMEROS = {
  chave: 'suporte',
  numero: '24h',
  rotulo: 'Suporte Técnico',
  requer: ['support24h'],
} as const satisfies {
  chave: string
  numero: string
  rotulo: string
  requer: readonly Compromisso[]
}

/** Subtítulo do cartão de e-mail do contato, sem e-mail de marketing. */
export const RESPOSTA_DO_EMAIL: FraseDeCompromisso = {
  chave: 'resposta-email',
  texto: 'Resposta em até 24 horas',
  requer: ['responseWithin24h'],
}

/** Linha do rodapé e do contato da home. */
export const RESPOSTA_RAPIDA: FraseDeCompromisso = {
  chave: 'resposta-rapida',
  texto: 'Resposta rápida garantida',
  requer: ['fastResponseGuaranteed'],
}

/** Pergunta do FAQ do JSON-LD (raiz legada) que afirma certificação. */
export const FAQ_CERTIFICACAO = {
  question: 'Os equipamentos possuem certificação de segurança?',
  answer:
    'Sim, todos os nossos equipamentos passam por manutenção regular e possuem certificação de segurança conforme normas vigentes. Garantimos equipamentos em perfeito estado de funcionamento.',
  requer: ['certifiedEquipment'],
} as const satisfies {
  question: string
  answer: string
  requer: readonly Compromisso[]
}

/** Frase de certificação no serviço de andaimes do JSON-LD da raiz legada (achado da onda 134, além do §2.3). */
export const SERVICO_COM_CERTIFICACAO: FraseDeCompromisso = {
  chave: 'servico-andaimes',
  texto: 'Equipamentos com manutenção em dia e certificação de segurança.',
  requer: ['certifiedEquipment'],
}

/**
 * O que cada compromisso publica no site da locadora (onda 134, B10): as frases exatas, na ordem das telas (detalhe,
 * "Por que escolher" da home, contato, rodapé e JSON-LD), para o painel mostrar ao lado de cada interruptor. Cartão vira
 * "Título: descrição"; o FAQ, "Pergunta resposta".
 */
export function frasesPorCompromisso(
  cidade: string | null | undefined
): Record<Compromisso, string[]> {
  const elementos: Array<{ texto: string; requer: readonly Compromisso[] }> = [
    ...DETALHE_TOPO,
    ...DETALHE_INCLUIDO,
    ...[
      ...detalhePorQueEscolher(cidade),
      ...beneficiosComCompromisso(cidade),
      ...SERVICOS_DO_CONTATO,
    ].map((cartao) => ({
      texto: `${cartao.titulo}: ${cartao.descricao}`,
      requer: cartao.requer,
    })),
    ...SELOS_DO_CONTATO,
    {
      texto: `${SUPORTE_NOS_NUMEROS.numero} ${SUPORTE_NOS_NUMEROS.rotulo}`,
      requer: SUPORTE_NOS_NUMEROS.requer,
    },
    RESPOSTA_DO_EMAIL,
    RESPOSTA_RAPIDA,
    {
      texto: `${FAQ_CERTIFICACAO.question} ${FAQ_CERTIFICACAO.answer}`,
      requer: FAQ_CERTIFICACAO.requer,
    },
    SERVICO_COM_CERTIFICACAO,
  ]
  const frases = Object.fromEntries(
    SITE_CONTENT_COMMITMENTS.map((chave) => [chave, [] as string[]])
  ) as Record<Compromisso, string[]>
  for (const { texto, requer } of elementos)
    for (const chave of requer)
      if (!frases[chave].includes(texto)) frases[chave].push(texto)
  return frases
}
