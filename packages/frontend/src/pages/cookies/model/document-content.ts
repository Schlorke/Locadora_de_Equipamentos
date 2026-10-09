import type { DocumentNode } from '@gb-locacoes/ui'
export const sections = [
  { id: 'introducao', title: 'Introdução' },
  { id: 'tipos-cookies', title: 'Tipos de Cookies' },
  { id: 'cookies-essenciais', title: 'Cookies Essenciais' },
  { id: 'cookies-funcionalidade', title: 'Cookies de Funcionalidade' },
  { id: 'cookies-analytics', title: 'Cookies de Analytics' },
  { id: 'gerenciar-cookies', title: 'Como Gerenciar Cookies' },
  { id: 'contato', title: 'Contato' },
]
export const documentMetadata = {
  title: 'Política de Cookies',
  subtitle: 'Entenda como utilizamos cookies para melhorar sua experiência',
  updatedAt: '23 de Junho de 2025',
}
export const documentBlocks: DocumentNode[] = [
  {
    tag: 'Card',
    props: {
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0',
    },
    children: [
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'div',
            props: {
              className:
                'p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-blue-100/50',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] leading-relaxed text-gray-700 m-0',
                },
                children: [
                  'Esta Política de Cookies explica o que são cookies, como os usamos e quais são suas opções em relação aos cookies que utilizamos em nosso site.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    tag: 'Card',
    props: {
      id: 'introducao',
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 scroll-mt-32',
    },
    children: [
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'h2',
            props: {
              className:
                'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
            },
            children: [
              {
                tag: 'span',
                props: {
                  className: 'text-orange-600',
                },
                children: ['1.'],
              },
              'Introdução',
            ],
          },
          {
            tag: 'div',
            props: {
              className: 'space-y-4 leading-relaxed',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Cookies são pequenos arquivos de texto que são colocados no seu computador ou dispositivo móvel quando você visita um site. Eles são amplamente utilizados para fazer os sites funcionarem, ou funcionarem de forma mais eficiente, bem como para fornecer informações aos proprietários do site.',
                ],
              },
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Usamos cookies para melhorar sua experiência em nosso site, lembrar suas preferências e entender como você interage com nosso conteúdo.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    tag: 'Card',
    props: {
      id: 'tipos-cookies',
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 scroll-mt-32',
    },
    children: [
      {
        tag: 'div',
        props: {
          className:
            'absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent opacity-30',
        },
        children: [],
      },
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'h2',
            props: {
              className:
                'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
            },
            children: [
              {
                tag: 'span',
                props: {
                  className: 'text-orange-600',
                },
                children: ['2.'],
              },
              'Tipos de Cookies',
            ],
          },
          {
            tag: 'div',
            props: {
              className: 'space-y-4 leading-relaxed',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Utilizamos os seguintes tipos de cookies em nosso site:',
                ],
              },
              {
                tag: 'div',
                props: {
                  className: 'grid grid-cols-1 gap-4 mt-6',
                },
                children: [
                  {
                    tag: 'div',
                    props: {
                      className:
                        'p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-l-4 border-green-500',
                    },
                    children: [
                      {
                        tag: 'div',
                        props: {
                          className: 'flex items-start gap-3',
                        },
                        children: [
                          {
                            tag: 'div',
                            props: {
                              className: 'p-2 bg-green-500 rounded-lg',
                            },
                            children: [
                              {
                                tag: 'CheckCircle',
                                props: {
                                  className: 'h-4 w-4 text-white',
                                },
                              },
                            ],
                          },
                          {
                            tag: 'div',
                            children: [
                              {
                                tag: 'h4',
                                props: {
                                  className: 'font-semibold text-gray-900 mb-2',
                                },
                                children: ['Cookies Essenciais'],
                              },
                              {
                                tag: 'p',
                                props: {
                                  className: 'text-[16px] text-gray-700',
                                },
                                children: [
                                  'Necessários para o funcionamento básico do site',
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    tag: 'div',
                    props: {
                      className:
                        'p-5 bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border-l-4 border-blue-500',
                    },
                    children: [
                      {
                        tag: 'div',
                        props: {
                          className: 'flex items-start gap-3',
                        },
                        children: [
                          {
                            tag: 'div',
                            props: {
                              className: 'p-2 bg-blue-500 rounded-lg',
                            },
                            children: [
                              {
                                tag: 'CheckCircle',
                                props: {
                                  className: 'h-4 w-4 text-white',
                                },
                              },
                            ],
                          },
                          {
                            tag: 'div',
                            children: [
                              {
                                tag: 'h4',
                                props: {
                                  className: 'font-semibold text-gray-900 mb-2',
                                },
                                children: ['Cookies de Funcionalidade'],
                              },
                              {
                                tag: 'p',
                                props: {
                                  className: 'text-[16px] text-gray-700',
                                },
                                children: [
                                  'Lembram suas preferências e escolhas',
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    tag: 'div',
                    props: {
                      className:
                        'p-5 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border-l-4 border-purple-500',
                    },
                    children: [
                      {
                        tag: 'div',
                        props: {
                          className: 'flex items-start gap-3',
                        },
                        children: [
                          {
                            tag: 'div',
                            props: {
                              className: 'p-2 bg-purple-500 rounded-lg',
                            },
                            children: [
                              {
                                tag: 'CheckCircle',
                                props: {
                                  className: 'h-4 w-4 text-white',
                                },
                              },
                            ],
                          },
                          {
                            tag: 'div',
                            children: [
                              {
                                tag: 'h4',
                                props: {
                                  className: 'font-semibold text-gray-900 mb-2',
                                },
                                children: ['Cookies de Analytics'],
                              },
                              {
                                tag: 'p',
                                props: {
                                  className: 'text-[16px] text-gray-700',
                                },
                                children: [
                                  'Ajudam a entender como você usa o site',
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    tag: 'Card',
    props: {
      id: 'cookies-essenciais',
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 scroll-mt-32',
    },
    children: [
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'h2',
            props: {
              className:
                'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
            },
            children: [
              {
                tag: 'span',
                props: {
                  className: 'text-orange-600',
                },
                children: ['3.'],
              },
              'Cookies Essenciais',
            ],
          },
          {
            tag: 'div',
            props: {
              className: 'space-y-4 leading-relaxed',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Estes cookies são estritamente necessários para fornecer serviços disponíveis em nosso site e para usar alguns de seus recursos, como acesso a áreas seguras.',
                ],
              },
              {
                tag: 'div',
                props: {
                  className:
                    'p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-green-200/50',
                },
                children: [
                  {
                    tag: 'p',
                    props: {
                      className: 'text-[16px] text-gray-700',
                    },
                    children: [
                      {
                        tag: 'span',
                        props: {
                          className: 'font-medium text-green-700',
                        },
                        children: ['Exemplos:'],
                      },
                      ' ',
                      'Cookies de autenticação, segurança e gerenciamento de sessão',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    tag: 'Card',
    props: {
      id: 'cookies-funcionalidade',
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 scroll-mt-32',
    },
    children: [
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'h2',
            props: {
              className:
                'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
            },
            children: [
              {
                tag: 'span',
                props: {
                  className: 'text-orange-600',
                },
                children: ['4.'],
              },
              'Cookies de Funcionalidade',
            ],
          },
          {
            tag: 'div',
            props: {
              className: 'space-y-4 leading-relaxed',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Estes cookies nos permitem lembrar as escolhas que você faz quando usa nosso site, como lembrar seus detalhes de login ou preferência de idioma.',
                ],
              },
              {
                tag: 'div',
                props: {
                  className:
                    'p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-blue-200/50',
                },
                children: [
                  {
                    tag: 'p',
                    props: {
                      className: 'text-[16px] text-gray-700',
                    },
                    children: [
                      {
                        tag: 'span',
                        props: {
                          className: 'font-medium text-blue-700',
                        },
                        children: ['Exemplos:'],
                      },
                      ' ',
                      'Preferências de idioma, configurações de exibição e personalizações',
                    ],
                  },
                ],
              },
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'O objetivo destes cookies é proporcionar uma experiência mais personalizada e evitar que você tenha que inserir novamente suas preferências toda vez que usar nosso site.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    tag: 'Card',
    props: {
      id: 'cookies-analytics',
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 scroll-mt-32',
    },
    children: [
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'h2',
            props: {
              className:
                'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
            },
            children: [
              {
                tag: 'span',
                props: {
                  className: 'text-orange-600',
                },
                children: ['5.'],
              },
              'Cookies de Analytics',
            ],
          },
          {
            tag: 'div',
            props: {
              className: 'space-y-4 leading-relaxed',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Estes cookies nos permitem reconhecer e contar o número de visitantes e ver como os visitantes se movem pelo site quando o estão usando.',
                ],
              },
              {
                tag: 'div',
                props: {
                  className:
                    'p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-purple-200/50',
                },
                children: [
                  {
                    tag: 'p',
                    props: {
                      className: 'text-[16px] text-gray-700',
                    },
                    children: [
                      {
                        tag: 'span',
                        props: {
                          className: 'font-medium text-purple-700',
                        },
                        children: ['Exemplos:'],
                      },
                      ' ',
                      'Google Analytics, métricas de performance e análise de comportamento do usuário',
                    ],
                  },
                ],
              },
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Isso nos ajuda a melhorar a forma como nosso site funciona, por exemplo, garantindo que os usuários encontrem facilmente o que procuram.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    tag: 'Card',
    props: {
      id: 'gerenciar-cookies',
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 scroll-mt-32',
    },
    children: [
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'h2',
            props: {
              className:
                'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
            },
            children: [
              {
                tag: 'span',
                props: {
                  className: 'text-orange-600',
                },
                children: ['6.'],
              },
              'Como Gerenciar Cookies',
            ],
          },
          {
            tag: 'div',
            props: {
              className: 'space-y-4 leading-relaxed',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'Você pode controlar e excluir cookies conforme desejar. Você pode excluir todos os cookies que já estão no seu computador e pode configurar a maioria dos navegadores para impedir que sejam colocados.',
                ],
              },
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700',
                },
                children: [
                  'No entanto, se você fizer isso, talvez precise ajustar manualmente algumas preferências toda vez que visitar um site e alguns serviços e funcionalidades podem não funcionar.',
                ],
              },
              {
                tag: 'div',
                props: {
                  className:
                    'p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-yellow-200/50 mt-4',
                },
                children: [
                  {
                    tag: 'p',
                    props: {
                      className: 'text-[16px] text-gray-700',
                    },
                    children: [
                      {
                        tag: 'span',
                        props: {
                          className: 'font-medium text-yellow-700',
                        },
                        children: ['Nota:'],
                      },
                      ' ',
                      'Para gerenciar cookies, acesse as configurações do seu navegador',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    tag: 'Card',
    props: {
      id: 'contato',
      className:
        'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 scroll-mt-32',
    },
    children: [
      {
        tag: 'CardContent',
        props: {
          className: 'relative z-10 p-6 md:p-8',
        },
        children: [
          {
            tag: 'h2',
            props: {
              className:
                'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
            },
            children: [
              {
                tag: 'span',
                props: {
                  className: 'text-orange-600',
                },
                children: ['7.'],
              },
              'Contato',
            ],
          },
          {
            tag: 'div',
            props: {
              className: 'space-y-4',
            },
            children: [
              {
                tag: 'p',
                props: {
                  className: 'text-[16px] text-gray-700 leading-relaxed',
                },
                children: [
                  'Se você tiver dúvidas sobre nossa Política de Cookies, entre em contato:',
                ],
              },
              {
                tag: 'ContactInfoCard',
                props: {
                  description:
                    'Estamos prontos para esclarecer suas dúvidas sobre cookies.',
                },
              },
            ],
          },
        ],
      },
    ],
  },
]
