// Dados públicos da GB Locações para o corte do conteúdo da vitrine (onda 134, lote vitrine-conteúdo; runbook
// docs/operations/gb-site-settings.md). Decisões do dono de 2026-10-06 (ADR adr-saas-subscription, B.18, itens 2 e 3) e de
// 2026-10-07 (D-A, D-B, D-E): o conteúdo institucional e os textos legais passaram a ser de cada locadora, no painel; o
// frontend não traz mais dado da GB (T12). Estes valores saem do código que a GB tinha no ar e só o
// tools/gb-site-settings.mjs os grava, e só nos campos vazios da organização com o CNPJ da GB.
//
// Fontes: produção `eb4c0098` (main) e a versão FSD com o conteúdo da GB, anterior à onda 132, `55763c1e`.
// - Ficam de fora a frota (D-B: o dono preenche no painel; o script não escolhe entre os "+200" do hero e os "50+" do
//   contato) e a nota de avaliações (D-A: a produção não tinha fonte; sem fonte, não há nota).
// - Os 11 compromissos comerciais ficam todos ligados (D-E: a produção mostrava todos).
// - Os textos legais são os do código atual (iguais aos da produção), no formato do contrato
//   (packages/contracts/src/storefront-legal.ts), gerados uma vez a partir de entities/termo/model/terms-content.ts, da
//   abertura e da nota do cartão de pages/termos/ui/TermosPage.web.tsx e das árvores de
//   pages/{privacidade,politica-devolucao}/model/document-content.ts.
// Script em Node puro: não importa o contrato TS; tests/unit/gb-site-content.test.ts valida tudo contra os esquemas.

/** Conteúdo institucional da GB (`settings.siteContent`), sem frota (D-B) e sem nota de avaliações (D-A). */
export const GB_SITE_CONTENT = Object.freeze({
  // 55763c1e: widgets/hero/ui/Hero.web.tsx:234 ("Há 10 anos"), widgets/por-que-escolher/ui/PorQueEscolher.web.tsx:41-43
  // ("10 Anos de Experiência") e pages/sobre/ui/SobrePage.tsx:59-62 ("10+ Anos de Experiência").
  experienceYears: 10,
  // 55763c1e: pages/sobre/ui/SobrePage.tsx:66 e 315-317 ("500+ Clientes Satisfeitos").
  clientsServed: 500,
  // 55763c1e: pages/contato/model/use-contact-page.ts:65 ("500+ Projetos Realizados").
  projectsCompleted: 500,
  // 55763c1e: pages/sobre/ui/SobrePage.tsx:80-84 ("50+ Cidades Atendidas").
  citiesServed: 50,
  // 55763c1e: widgets/por-que-escolher/ui/PorQueEscolher.web.tsx:36.
  featuredClients: Object.freeze([
    'Melnick',
    'Cyrela',
    'Joal Teitelbaum',
    'UMA Incorporadora',
    'ABF Developments',
  ]),
  // 55763c1e: pages/sobre/ui/SobrePage.tsx:250-252 (1º parágrafo de "Nossa História").
  history:
    'A GB Locações nasceu da necessidade de oferecer equipamentos de construção civil com qualidade e confiabilidade para empresas e profissionais da região de Porto Alegre.',
  // 55763c1e: pages/sobre/ui/SobrePage.tsx:112-136 ("Nossa Jornada").
  timeline: Object.freeze([
    Object.freeze({
      year: 2014,
      title: 'Fundação da GB Locações',
      description:
        'Início das atividades com foco em equipamentos para construção civil',
    }),
    Object.freeze({
      year: 2017,
      title: 'Expansão da Frota',
      description: 'Ampliação significativa do catálogo de equipamentos',
    }),
    Object.freeze({
      year: 2020,
      title: 'Modernização Digital',
      description: 'Implementação de sistemas digitais para melhor atendimento',
    }),
    Object.freeze({
      year: 2024,
      title: 'Líder Regional',
      description: 'Consolidação como referência em locação de equipamentos',
    }),
  ]),
  // eb4c0098: components/footer.tsx:193-233 (coluna "Equipamentos" do rodapé).
  footerHighlights: Object.freeze([
    'Andaimes Suspensos',
    'Cadeiras Elétricas',
    'Andaimes Tubulares',
    'Betoneiras',
    'Rompedores',
    'Compressores',
  ]),
  // D-E: a produção mostrava todas as promessas do modelo (detalhe, contato, "Por que escolher", rodapé).
  commitments: Object.freeze({
    certifiedEquipment: true,
    freeDelivery: true,
    fastDelivery: true,
    sameDayDelivery: true,
    ownLogistics: true,
    equipmentTracking: true,
    support24h: true,
    flexibleScheduling: true,
    freeConsulting: true,
    responseWithin24h: true,
    fastResponseGuaranteed: true,
  }),
  // eb4c0098: components/google-store-locator.tsx:9-14 (coordenadas, Place ID e as duas linhas de endereço).
  storeLocation: Object.freeze({
    latitude: -29.9943488,
    longitude: -51.1975239,
    placeId: 'ChIJJZbj9_l5GZURSyYQSxkhy8k',
    addressLine1: 'Travessa Doutor Heinzelmann, 365',
    addressLine2: 'Porto Alegre, RS, Brazil',
  }),
  // 55763c1e: widgets/avaliacoes-google/ui/Avaliacoes.web.tsx:20 (selo e pesquisa do Google Avaliações do Consumidor).
  googleMerchantId: '5721491678',
  // Onda 135, A11 (decisão do dono D4 de 2026-10-08): medição da GB. O antigo app/layout.tsx da raiz foi retirado em F;
  // a referência histórica eb4c0098:191/:193 documenta os IDs padrão de Analytics 4/Google Ads usados quando
  // NEXT_PUBLIC_GA_MEASUREMENT_ID/NEXT_PUBLIC_GOOGLE_ADS_ID faltavam.
  googleAnalyticsId: 'G-5S49T61C7N',
  googleAdsId: 'AW-17933178077',
})

/** O que o script nunca grava, com a decisão que o deixa para o dono no painel. */
export const GB_SITE_CONTENT_PENDING = Object.freeze([
  'siteContent.fleetSize (D-B)',
  'siteContent.reviews (D-A)',
  // D4: na produção os dois códigos vinham do ambiente (GOOGLE_SITE_VERIFICATION e FACEBOOK_DOMAIN_VERIFICATION em
  // antigo app/layout.tsx:157-171 da raiz, retirado em F), nunca do código; o script não inventa valor.
  // O dono informa no painel ou verifica pelo DNS.
  'siteContent.googleSiteVerification (D4)',
  'siteContent.facebookDomainVerification (D4)',
])

/**
 * Textos legais da GB no formato do contrato: Termos (data em entities/termo/model/terms-content.ts:11; abertura e nota
 * do cartão em pages/termos/ui/TermosPage.web.tsx:204-209 e 230-232), Política de Privacidade
 * (pages/privacidade/model/document-content.ts; data na linha 14) e Política de Devolução
 * (pages/politica-devolucao/model/document-content.ts; data na linha 16, nota do cartão nas linhas 764-769).
 */
export const GB_LEGAL_DOCUMENTS = deepFreeze({
  terms: {
    version: 1,
    lastUpdated: '19 de janeiro de 2026',
    intro:
      'Bem-vindo aos Termos e Condições de Uso da GB Locações. Ao utilizar nossos serviços, você concorda com estes termos. Por favor, leia-os cuidadosamente antes de utilizar nosso site e serviços.',
    sections: [
      {
        id: 'introducao',
        title: 'Introdução',
        blocks: [
          {
            type: 'paragraph',
            text: 'Bem-vindo aos Termos e Condições de Uso da GB Locações. Ao utilizar nossos serviços, você concorda com estas condições.',
          },
          {
            type: 'paragraph',
            text: 'Se você não concordar com qualquer parte destes Termos, não deve utilizar a plataforma.',
          },
        ],
      },
      {
        id: 'objeto',
        title: 'Objeto e Aceitação',
        blocks: [
          {
            type: 'paragraph',
            text: 'Estes Termos regulam o acesso e o uso da plataforma GB Locações para solicitação de orçamentos e contratação de locações de equipamentos para construção civil.',
          },
          {
            type: 'paragraph',
            text: 'Ao acessar, cadastrar-se ou utilizar a plataforma, o usuário declara que leu, compreendeu e concordou com estes Termos e com a Política de Privacidade.',
          },
          {
            type: 'paragraph',
            text: 'Estes Termos complementam o Contrato de Locação firmado entre as partes, quando aplicável.',
          },
        ],
      },
      {
        id: 'cadastro',
        title: 'Cadastro e Conta de Usuário',
        blocks: [
          {
            type: 'paragraph',
            text: 'O usuário é responsável por fornecer informações verdadeiras, completas e atualizadas, bem como por manter a confidencialidade de seus dados de acesso.',
          },
          {
            type: 'list',
            items: [
              'Responsabilizar-se por todas as atividades realizadas em sua conta.',
              'Comunicar imediatamente qualquer uso não autorizado.',
              'Manter seus dados de contato atualizados.',
            ],
          },
          {
            type: 'paragraph',
            text: 'A GB Locações pode suspender ou cancelar o acesso em caso de informações inconsistentes, fraude ou violação destes Termos.',
          },
        ],
      },
      {
        id: 'orcamentos',
        title: 'Orçamentos, Reajustes e Pagamentos',
        blocks: [
          {
            type: 'paragraph',
            text: 'O orçamento gerado na plataforma tem caráter estimativo e depende de confirmação de disponibilidade e análise operacional.',
          },
          {
            type: 'list',
            items: [
              'A solicitação de orçamento não garante disponibilidade imediata do equipamento.',
              'A locação somente é efetivada após confirmação e pagamento.',
              'O administrador pode reajustar o orçamento antes da emissão do boleto.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Reajustes podem incluir custos de logística, montagem/desmontagem, deslocamento, combustível, transporte, motorista ou outras condições específicas do atendimento.',
          },
          {
            type: 'paragraph',
            text: 'O pagamento do boleto representa a aceitação do valor final. Caso o cliente não concorde, pode optar por não efetuar o pagamento, e a locação não será concluída.',
          },
        ],
      },
      {
        id: 'custos-adicionais',
        title: 'Custos Adicionais e Serviços Complementares',
        blocks: [
          {
            type: 'paragraph',
            text: 'Serviços e custos adicionais poderão ser cobrados conforme as condições do atendimento e serão informados no orçamento final e/ou contrato.',
          },
          {
            type: 'list',
            items: [
              'Frete, deslocamento e distância.',
              'Carga, descarga, montagem e desmontagem.',
              'Serviços de logística, motorista ou espera no local.',
            ],
          },
        ],
      },
      {
        id: 'uso-equipamento',
        title: 'Uso do Equipamento e Prazo da Locação',
        blocks: [
          {
            type: 'paragraph',
            text: 'O equipamento deve ser utilizado de forma segura, dentro das normas técnicas e apenas para os fins contratados.',
          },
          {
            type: 'list',
            items: [
              'Respeitar o período de locação definido no orçamento/contrato.',
              'Não utilizar o equipamento fora das datas combinadas (inclusive finais de semana não previstos).',
              'Garantir que apenas pessoas qualificadas operem o equipamento.',
              'Zelar pela guarda e conservação do equipamento durante a locação.',
            ],
          },
        ],
      },
      {
        id: 'atraso',
        title: 'Atraso, Multas e Prorrogações',
        blocks: [
          {
            type: 'paragraph',
            text: 'A devolução após o prazo contratado pode gerar cobranças adicionais, incluindo multa e diárias extras.',
          },
          {
            type: 'paragraph',
            text: 'Critérios e valores serão informados no orçamento final e/ou contrato vigente.',
          },
          {
            type: 'paragraph',
            text: 'Pedidos de prorrogação estão sujeitos à disponibilidade e podem resultar em novo orçamento.',
          },
        ],
      },
      {
        id: 'danos',
        title: 'Danos, Avarias e Perdas de Peças',
        blocks: [
          {
            type: 'paragraph',
            text: 'O cliente é responsável por danos, avarias, extravios ou perdas de peças ocorridos durante o período de locação.',
          },
          {
            type: 'paragraph',
            text: 'Quando aplicável, os custos poderão ser apurados e adicionados ao valor final, com a respectiva justificativa.',
          },
        ],
      },
      {
        id: 'inspecao',
        title: 'Inspeção e Aceite na Entrega/Devolução',
        blocks: [
          {
            type: 'paragraph',
            text: 'Na entrega e na devolução, poderá ser realizada inspeção com checklist, registro de condição e assinatura/aceite do responsável.',
          },
          {
            type: 'paragraph',
            text: 'Eventuais divergências devem ser registradas no ato da entrega ou coleta.',
          },
        ],
      },
      {
        id: 'cancelamentos',
        title: 'Cancelamentos e Desistências',
        blocks: [
          {
            type: 'paragraph',
            text: 'Condições de cancelamento, remarcação ou desistência serão informadas no orçamento final e/ou contrato vigente.',
          },
        ],
      },
      {
        id: 'lgpd',
        title: 'Proteção de Dados Pessoais (LGPD)',
        blocks: [
          {
            type: 'paragraph',
            text: 'A GB Locações trata dados pessoais conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
          },
          {
            type: 'paragraph',
            text: 'Para mais detalhes sobre o tratamento de dados, consulte a Política de Privacidade disponível na plataforma.',
          },
        ],
      },
      {
        id: 'propriedade',
        title: 'Propriedade Intelectual',
        blocks: [
          {
            type: 'paragraph',
            text: 'Todo o conteúdo da plataforma, incluindo marcas, textos, imagens, layout e software, é de propriedade da GB Locações ou de seus licenciantes.',
          },
          {
            type: 'paragraph',
            text: 'É vedada a reprodução ou uso não autorizado do conteúdo.',
          },
        ],
      },
      {
        id: 'limitacoes',
        title: 'Limitações de Responsabilidade',
        blocks: [
          {
            type: 'paragraph',
            text: 'A GB Locações não se responsabiliza por:',
          },
          {
            type: 'list',
            items: [
              'Danos decorrentes de uso inadequado ou negligente dos equipamentos.',
              'Acidentes ou prejuízos causados por operação indevida.',
              'Lucros cessantes ou danos indiretos.',
            ],
          },
        ],
      },
      {
        id: 'alteracoes',
        title: 'Alterações nos Termos',
        blocks: [
          {
            type: 'paragraph',
            text: 'A GB Locações pode atualizar estes Termos a qualquer momento. A versão vigente estará disponível na plataforma.',
          },
          {
            type: 'paragraph',
            text: 'O uso continuado após a publicação das alterações representa aceitação dos novos Termos.',
          },
        ],
      },
      {
        id: 'contato',
        title: 'Contato',
        blocks: [
          {
            type: 'paragraph',
            text: 'Em caso de dúvidas, entre em contato pelos canais oficiais informados na plataforma.',
          },
        ],
        contactCard: true,
        contactCardNote:
          'Estamos à disposição para esclarecer quaisquer dúvidas.',
      },
    ],
  },
  privacy: {
    version: 1,
    lastUpdated: '23 de Junho de 2025',
    intro:
      'A sua privacidade é importante para nós. É política da GB Locações respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar no site GB Locações, e outros sites que possuímos e operamos.',
    sections: [
      {
        id: 'informacoes-coletadas',
        title: 'Informações que Coletamos',
        blocks: [
          {
            type: 'paragraph',
            text: 'Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço. Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que estamos coletando e como será usado.',
          },
          {
            type: 'paragraph',
            text: 'Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado. Quando armazenamos dados, protegemos dentro de meios comercialmente aceitáveis para evitar perdas e roubos, bem como acesso, divulgação, cópia, uso ou modificação não autorizados.',
          },
        ],
      },
      {
        id: 'como-usamos',
        title: 'Como Usamos Suas Informações',
        blocks: [
          {
            type: 'paragraph',
            text: 'Usamos as informações que coletamos de várias maneiras, incluindo para:',
          },
          {
            type: 'list',
            items: [
              'Fornecer, operar e manter nosso site',
              'Melhorar, personalizar e expandir nosso site',
              'Entender e analisar como você usa nosso site',
              'Desenvolver novos produtos, serviços, recursos e funcionalidades',
              'Comunicar com você, diretamente ou através de um de nossos parceiros',
              'Enviar e-mails',
              'Encontrar e prevenir fraudes',
            ],
          },
        ],
      },
      {
        id: 'cookies',
        title: 'Cookies e Tecnologias',
        blocks: [
          {
            type: 'paragraph',
            text: 'Usamos cookies e tecnologias semelhantes para rastrear a atividade em nosso site e armazenar certas informações. As tecnologias de rastreamento usadas incluem beacons, tags e scripts para coletar e rastrear informações e para melhorar e analisar nosso serviço.',
          },
          {
            type: 'paragraph',
            text: 'Você pode instruir seu navegador a recusar todos os cookies ou a indicar quando um cookie está sendo enviado. No entanto, se você não aceitar cookies, talvez não consiga usar algumas partes do nosso serviço.',
          },
        ],
      },
      {
        id: 'links-terceiros',
        title: 'Links para Terceiros',
        blocks: [
          {
            type: 'paragraph',
            text: 'Nosso serviço pode conter links para sites de terceiros que não são operados por nós. Se você clicar em um link de terceiros, será direcionado para o site desse terceiro.',
          },
          {
            type: 'paragraph',
            text: 'Recomendamos fortemente que você revise a Política de Privacidade de cada site que visitar. Não temos controle sobre e não assumimos responsabilidade pelo conteúdo, políticas de privacidade ou práticas de sites ou serviços de terceiros.',
          },
        ],
      },
      {
        id: 'consentimento',
        title: 'Consentimento',
        blocks: [
          {
            type: 'paragraph',
            text: 'Ao usar nosso site, você consente com nossa política de privacidade e concorda com seus termos. Você tem o direito de retirar seu consentimento a qualquer momento.',
          },
        ],
      },
      {
        id: 'alteracoes',
        title: 'Alterações na Política',
        blocks: [
          {
            type: 'paragraph',
            text: 'Podemos atualizar nossa Política de Privacidade de tempos em tempos. Notificaremos você sobre quaisquer alterações, publicando a nova Política de Privacidade nesta página.',
          },
          {
            type: 'paragraph',
            text: 'Recomendamos que você revise esta Política de Privacidade periodicamente para quaisquer alterações. As alterações a esta Política de Privacidade são efetivas quando publicadas nesta página.',
          },
        ],
      },
      {
        id: 'contato',
        title: 'Contato',
        blocks: [
          {
            type: 'paragraph',
            text: 'Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato conosco:',
          },
        ],
        contactCard: true,
      },
    ],
  },
  returnPolicy: {
    version: 1,
    lastUpdated: '13 de Fevereiro de 2026',
    intro:
      'A GB Locações preza pela transparência e satisfação dos nossos clientes. Esta política descreve os procedimentos, prazos e condições para a devolução dos equipamentos locados. Ao contratar nossos serviços, você concorda com os termos aqui descritos.',
    sections: [
      {
        id: 'condicoes-gerais',
        title: 'Condições Gerais',
        blocks: [
          {
            type: 'paragraph',
            text: 'A devolução dos equipamentos locados deve seguir as condições estabelecidas no contrato de locação. O cliente é responsável pela devolução do equipamento nas mesmas condições em que o recebeu, considerando o desgaste natural de uso.',
          },
          {
            type: 'list',
            items: [
              'Os equipamentos devem ser devolvidos limpos e em pleno funcionamento',
              'Todos os acessórios e componentes fornecidos devem acompanhar a devolução',
              'A devolução pode ser realizada presencialmente em nosso estabelecimento ou por meio de coleta agendada',
              'Equipamentos devolvidos fora do horário comercial serão inspecionados no próximo dia útil',
            ],
          },
        ],
      },
      {
        id: 'prazo-devolucao',
        title: 'Prazo para Devolução',
        blocks: [
          {
            type: 'paragraph',
            text: 'O equipamento deve ser devolvido até a data estabelecida no contrato de locação. Caso necessite de prorrogação, entre em contato conosco com antecedência mínima de 24 horas.',
          },
          {
            type: 'list',
            items: [
              {
                lead: 'Locação diária:',
                text: 'devolução até o horário contratado no dia seguinte',
              },
              {
                lead: 'Locação semanal:',
                text: 'devolução até o mesmo dia e horário da semana seguinte',
              },
              {
                lead: 'Locação mensal:',
                text: 'devolução até a mesma data do mês subsequente',
              },
              'Atrasos na devolução serão cobrados proporcionalmente ao período excedente, com acréscimo de multa conforme contrato',
            ],
          },
        ],
      },
      {
        id: 'estado-equipamentos',
        title: 'Estado dos Equipamentos',
        blocks: [
          {
            type: 'paragraph',
            text: 'Na retirada do equipamento, é realizado um laudo de vistoria que documenta o estado atual do equipamento. Na devolução, um novo laudo será elaborado para comparação.',
          },
          {
            type: 'list',
            items: [
              'O desgaste natural decorrente do uso adequado é aceito sem custos adicionais',
              'Danos causados por mau uso, negligência ou operação inadequada serão de responsabilidade do locatário',
              'O equipamento deve ser devolvido com o mesmo nível de combustível/carga em que foi entregue',
              'Peças quebradas ou danificadas devem ser reportadas imediatamente à GB Locações',
            ],
          },
        ],
      },
      {
        id: 'processo-devolucao',
        title: 'Processo de Devolução',
        blocks: [
          {
            type: 'paragraph',
            text: 'Para devolver um equipamento, siga os passos abaixo:',
          },
          {
            type: 'list',
            items: [
              {
                lead: 'Agendamento:',
                text: 'entre em contato para agendar a devolução ou coleta do equipamento',
              },
              {
                lead: 'Limpeza:',
                text: 'realize a limpeza básica do equipamento antes da devolução',
              },
              {
                lead: 'Entrega:',
                text: 'leve o equipamento ao nosso estabelecimento ou aguarde a equipe de coleta no local combinado',
              },
              {
                lead: 'Vistoria:',
                text: 'acompanhe a inspeção do equipamento e assine o laudo de devolução',
              },
              {
                lead: 'Recibo:',
                text: 'receba o comprovante de devolução que encerra o contrato de locação',
              },
            ],
          },
        ],
      },
      {
        id: 'inspecao',
        title: 'Inspeção e Verificação',
        blocks: [
          {
            type: 'paragraph',
            text: 'Todos os equipamentos passam por inspeção no momento da devolução. Esta vistoria é realizada por nossa equipe técnica e inclui:',
          },
          {
            type: 'list',
            items: [
              'Verificação do funcionamento geral do equipamento',
              'Comparação com o laudo de vistoria inicial',
              'Conferência de todos os acessórios e componentes',
              'Registro fotográfico do estado de devolução',
            ],
          },
          {
            type: 'paragraph',
            text: 'Caso sejam identificados danos não previstos no desgaste natural, o cliente será notificado e um orçamento de reparo será apresentado.',
          },
        ],
      },
      {
        id: 'custos-taxas',
        title: 'Custos e Taxas',
        blocks: [
          {
            type: 'paragraph',
            text: 'A devolução do equipamento dentro do prazo e nas condições adequadas não gera custos adicionais. No entanto, as seguintes situações podem acarretar cobranças:',
          },
          {
            type: 'list',
            items: [
              {
                lead: 'Atraso na devolução:',
                text: 'cobrança proporcional ao período excedente acrescido de multa contratual',
              },
              {
                lead: 'Danos ao equipamento:',
                text: 'custo de reparo conforme orçamento apresentado ao cliente',
              },
              {
                lead: 'Peças faltantes:',
                text: 'cobrança do valor de reposição das peças ou acessórios',
              },
              {
                lead: 'Limpeza especial:',
                text: 'taxa aplicável caso o equipamento necessite de limpeza além do padrão',
              },
            ],
          },
          {
            type: 'paragraph',
            text: 'Não cobramos taxa de restocking (reestocagem) para devoluções realizadas dentro do prazo contratual.',
          },
        ],
      },
      {
        id: 'cancelamento',
        title: 'Cancelamento de Locação',
        blocks: [
          {
            type: 'paragraph',
            text: 'O cliente pode solicitar o cancelamento antecipado da locação e devolução do equipamento a qualquer momento, observando as seguintes condições:',
          },
          {
            type: 'list',
            items: [
              'Cancelamentos com mais de 48 horas de antecedência: sem custos adicionais',
              'Cancelamentos com menos de 48 horas: pode incidir taxa conforme contrato',
              'O valor da locação será cobrado proporcionalmente ao período utilizado',
              'Reembolsos, quando aplicáveis, são processados em até 10 dias úteis',
            ],
          },
        ],
      },
      {
        id: 'contato',
        title: 'Contato',
        blocks: [
          {
            type: 'paragraph',
            text: 'Para dúvidas sobre devolução de equipamentos, agendamento de coletas ou qualquer outra questão relacionada, entre em contato conosco:',
          },
        ],
        contactCard: true,
        contactCardNote:
          'Estamos à disposição para ajudar com a devolução dos seus equipamentos.',
      },
    ],
  },
})

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
