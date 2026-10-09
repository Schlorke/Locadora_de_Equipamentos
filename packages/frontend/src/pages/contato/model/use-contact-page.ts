import {
  RESPOSTA_DO_EMAIL,
  SELOS_DO_CONTATO,
  SERVICOS_DO_CONTATO,
  SUPORTE_NOS_NUMEROS,
  comCompromissosDeclarados,
  comMais,
  compromissosDeclarados,
  declarouTodos,
  faixasDoHorario,
  linhaDaFaixa,
  linhaLegal,
  localDaLoja,
  usePublicSettings,
} from '../../../entities/configuracao'
import { useIdentidadePublica } from '../../../entities/organizacao'

/** Dias úteis: o telefone só promete "segunda a sexta" quando a locadora abre nos cinco. */
const DIAS_UTEIS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const

/** Ícone de cada serviço do contato (a variante web e a nativa têm o mesmo mapa de ícones). */
const ICONE_DO_SERVICO = {
  agendamento: 'Calendar',
  qualidade: 'Award',
} as const

export function useContactPage() {
  const { settings, isLoading, error } = usePublicSettings()
  // Nome e cidade da própria locadora (cartão público), nunca os de outra (achado 143).
  const identidade = useIdentidadePublica()
  const cidade = identidade?.cidade ?? null
  const primaryEmail = settings.contactEmail
  const marketingEmail = settings.marketingEmail
  const contactAddress = settings.companyAddress
  // Horário da própria locadora (configurações públicas; achado 147), como na produção: a primeira faixa no destaque
  // e as demais, inclusive os dias fechados, no subtítulo ("Sábado: 8h às 12h • Domingo: Fechado").
  const faixas = faixasDoHorario(settings.businessHours)
  const linhasDoHorario = faixas.map((faixa) => linhaDaFaixa(faixa, 'longo'))
  const temHorarioAberto = faixas.some((faixa) => faixa.horario !== null)
  // Onda 134: conteúdo institucional e compromissos da própria locadora (painel); sem o dado, o elemento sai (D-E).
  const conteudo = settings.siteContent ?? {}
  const declarados = compromissosDeclarados(conteudo)
  const abreNosDiasUteis = DIAS_UTEIS.every(
    (dia) => settings.businessHours?.[dia]?.closed === false
  )
  // Telefone e WhatsApp da locadora, cada um só quando informado (vazio ou só espaços não conta): o separador da
  // produção (" | ") só entre os dois. Sem nenhum, o cartão sai, como o de horário; enquanto as configurações
  // carregam, fica no lugar (sem número nem separador) para não empurrar os outros cartões quando os números chegam.
  const linhaDoTelefone = [settings.companyPhone, settings.whatsappNumber]
    .map((numero) => numero?.trim() ?? '')
    .filter(Boolean)
    .join(' | ')
  const subtituloDoTelefone = [
    ...(abreNosDiasUteis ? ['Atendimento de segunda a sexta'] : []),
    ...(settings.whatsappNumber?.trim() ? ['WhatsApp disponível'] : []),
  ].join(' | ')
  const subtituloDoEmail = marketingEmail
    ? `${marketingEmail} · Automação comercial`
    : declarouTodos(declarados, RESPOSTA_DO_EMAIL.requer)
      ? RESPOSTA_DO_EMAIL.texto
      : ''

  const contactInfo = [
    ...(linhaDoTelefone || isLoading
      ? [
          {
            icon: 'Phone' as const,
            title: 'Telefone',
            main: linhaDoTelefone,
            subtitle: subtituloDoTelefone,
            color: 'orange', // token-check-allow: chave Tailwind orange já usada no card de contato
            delay: 0.1,
          },
        ]
      : []),
    {
      icon: 'Mail' as const,
      title: 'E-mail',
      main: primaryEmail,
      subtitle: subtituloDoEmail,
      color: 'blue', // token-check-allow: chave Tailwind blue já usada no card de contato
      delay: 0.2,
    },
    {
      icon: 'MapPin' as const,
      title: 'Endereço',
      main: contactAddress,
      subtitle: cidade
        ? `Atendimento em ${cidade} e região metropolitana`
        : 'Atendimento na região',
      color: 'green', // token-check-allow: chave Tailwind green já usada no card de contato
      delay: 0.3,
    },
    ...(temHorarioAberto
      ? [
          {
            icon: 'Clock' as const,
            title: 'Horário de Funcionamento',
            main: linhasDoHorario[0]!,
            subtitle: linhasDoHorario.slice(1).join(' • '),
            color: 'purple', // token-check-allow: chave Tailwind purple já usada no card de contato
            delay: 0.4,
          },
        ]
      : []),
  ]

  // "Atendimento Especializado" é declaração de valor do modelo; os demais, compromissos da locadora (regra E).
  const services = [
    {
      icon: 'Headphones' as const,
      title: 'Atendimento Especializado',
      description: 'Consultoria técnica para escolha dos equipamentos ideais',
    },
    ...comCompromissosDeclarados(declarados, SERVICOS_DO_CONTATO).map(
      (servico) => ({
        icon: ICONE_DO_SERVICO[servico.chave as keyof typeof ICONE_DO_SERVICO],
        title: servico.titulo,
        description: servico.descricao,
      })
    ),
  ]

  // Números do topo na ordem de 55763c1e (anos, projetos, frota e o suporte 24h), cada um só com o dado da locadora.
  const stats = [
    ...(conteudo.experienceYears
      ? [
          {
            number: comMais(conteudo.experienceYears),
            label: 'Anos de Experiência',
          },
        ]
      : []),
    ...(conteudo.projectsCompleted
      ? [
          {
            number: comMais(conteudo.projectsCompleted),
            label: 'Projetos Realizados',
          },
        ]
      : []),
    ...(conteudo.fleetSize
      ? [
          {
            number: comMais(conteudo.fleetSize),
            label: 'Equipamentos Disponíveis',
          },
        ]
      : []),
    ...(declarouTodos(declarados, SUPORTE_NOS_NUMEROS.requer)
      ? [
          {
            number: SUPORTE_NOS_NUMEROS.numero,
            label: SUPORTE_NOS_NUMEROS.rotulo,
          },
        ]
      : []),
  ]

  // Selos do cartão "Atendimento Especializado em Toda Região" (sem selo, a fileira sai).
  const selos = comCompromissosDeclarados(declarados, SELOS_DO_CONTATO).map(
    (selo) => selo.texto
  )
  // Local da loja no mapa "Onde estamos": o declarado pela própria locadora; sem ele, o cartão sai.
  const local = localDaLoja(conteudo, identidade?.nome)
  // Nome empresarial e CNPJ da própria locadora (app: o contato nativo mostra a linha; achado 147).
  const linhaDoCnpj = linhaLegal(
    settings.legalIdentity,
    identidade?.nome ?? null
  )

  return {
    contactInfo,
    services,
    stats,
    selos,
    local,
    linhaDoCnpj,
    cidade,
    isLoading,
    error,
  }
}
