// T12 da ADR docs/architecture/adr-tenant-hosts.md (Lote 5) e achado 143 da onda 132: o código que monta a vitrine,
// o painel e o app não traz dados reais da GB Locações: nem a identificação (nome, domínio, CNPJ, endereço, telefones,
// redes, conta do Merchant Center, Place ID e coordenadas) nem os fatos da empresa que o modelo de site afirmava para
// qualquer locadora (cidade e UF de atendimento, construtoras clientes, anos de mercado, números de frota, clientes e
// projetos, nota de avaliação fixa). Os dados de cada locadora vêm só do cartão público e das configurações dela;
// ausência é omissão neutra. Testes e fixtures ficam de fora. As pendências declaradas abaixo precisam continuar com dado
// da GB: quando deixarem de ter, saem da lista (a lista só encolhe). As quatro pendências U5 (textos legais) saíram na
// onda 134 (B8): os textos são o documento publicado por cada locadora, e os da GB vão pelo tools/gb-site-settings.mjs.
//
// Onda 134 (lote vitrine-conteúdo): o conteúdo institucional (anos, frota, clientes, projetos, cidades) passou a vir
// do painel de cada locadora, então o rótulo do modelo ("Anos de Experiência", `${anos} Anos de Experiência`) é
// permitido e só o número fixo acusa ("10+ Anos de Experiência", "+200 Equipamentos", "500+ Clientes"). O pacote de
// domínio entra na varredura: o frete simulado do orçamento ainda traz "Transportadora GB" e o CEP de origem da GB
// (requisito P-1, frete por locadora, lote próprio), declarados como pendências.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const ROOTS = [
  'packages/frontend/src',
  'packages/ui/src',
  'apps/clients/web/src',
  'apps/clients/mobile/src',
  'packages/domain/src',
]

/** Dados reais da GB que não podem aparecer fora de testes, fixtures e pendências declaradas. */
const DADOS_DA_GB: ReadonlyArray<readonly [string, RegExp]> = [
  ['nome', /\bG\s*B\s+LOCA[CÇ][OÕ]ES\b/i],
  ['nome sem acento', /\bGB\s+Locac[oõ]es\b/i],
  ['domínio', /locacoesgb/i],
  ['perfil do Instagram', /locacoes_gb/i],
  ['CNPJ', /34\.?780\.?330\/?0001-?69|\b34780330000169\b/],
  ['endereço', /heinzelmann/i],
  ['telefone fixo', /2313-?6262/],
  ['WhatsApp', /9?9820-?5163|5551998205163|555198205163/],
  ['Merchant Center', /5721491678/],
  ['Place ID', /ChIJJZbj9_l5GZURSyYQSxkhy8k/],
  ['coordenadas', /-29\.9943488|-51\.1975239/],
  // Fatos da GB que o modelo de site afirmava em qualquer locadora (segunda rodada do achado 143).
  ['cidade de atendimento', /Porto\s+Alegre/i],
  [
    'construtoras clientes',
    /Melnick|Cyrela|Joal\s+Teitelbaum|UMA\s+Incorporadora|ABF\s+Developments/i,
  ],
  [
    'anos de mercado',
    /\b\d+\s*\+?\s*Anos\s+de\s+Experi[eê]ncia|\bH[aá]\s+(?:mais\s+de\s+)?10\s+anos|mais\s+de\s+10\s+anos|d[eé]cada\s+atendendo/i,
  ],
  // Número solto como texto ou literal ('10+', ">+200<"): selos de anos, frota, clientes e cidades.
  ['números da empresa', /['"`>]\s*(?:\+200|10\+|500\+|50\+)\s*['"`<]/],
  // Onda 134: número fixo em texto corrido ("+200 Equipamentos Disponíveis", "500+ Clientes Satisfeitos").
  [
    'frota e números em texto corrido',
    /\+\s*\d+\s+Equipamentos|\b\d+\+\s+(?:Equipamentos|Clientes|Projetos|Cidades)/i,
  ],
  [
    'nota de avaliação fixa',
    /(?:^|[{,\s])(?:ratingValue|reviewCount)['"]?\s*:\s*['"`]?\d|['"`>]\s*4[.,]\d\s*['"`<]|★\s*4[.,]\d|\(\s*\d+\s+avalia[cç][oõ]es\s*\)|\b[0-5][.,]\d\s*[·•|]\s*\d+\+?\s*avalia[cç][oõ]es/im,
  ],
  ['UF de entrega no JSON-LD', /addressRegion\s*:\s*\[?\s*['"`]RS['"`]/],
  // Achado 146: a sigla da GB como marca (texto ou literal 'GB'), fora de uma lista de unidades ('MB', 'GB'), e a
  // contagem fixa de avaliações ("500+ avaliações"), que não vinha de avaliações da locadora.
  ['sigla da GB como marca', /(?<!B['"`],\s*)['"`>]\s*GB\s*['"`<]/],
  ['contagem fixa de avaliações', /\b\d+\+?\s+avalia[cç][oõ]es/i],
  // Onda 134 (P-1): frete simulado do orçamento com a transportadora e o CEP de origem da GB para qualquer locadora.
  ['transportadora da GB no frete', /Transportadora\s+GB\b/],
  ['CEP de origem da GB', /['"`]90000-?000['"`]/],
]

/** Pendências declaradas: arquivo → motivo. */
const PENDENTES: Readonly<Record<string, string>> = {
  'packages/domain/src/orcamento/frete.ts':
    'P-1 (onda 134): estimativa de frete com o rótulo "Transportadora GB" para qualquer locadora; frete por locadora em lote próprio.',
  'packages/frontend/src/pages/orcamento/model/use-quote-page.ts':
    'P-1 (onda 134): CEP de origem do frete fixo (o da GB) para qualquer locadora; frete por locadora em lote próprio.',
  'apps/clients/web/src/host/routing/public-entries.generated.ts':
    'Lista gerada dos arquivos de public/ da raiz (tools/generate-public-entries.mjs): o logo "GB Locações.png" é ativo da raiz, que sai no corte da GB (Lote 12).',
}

const TESTE = /\.(test|spec)\.[cm]?[jt]sx?$/
const CODIGO = /\.(?:[cm]?[jt]sx?|json|css)$/

function arquivos(dir: string): string[] {
  const absoluto = path.join(repoRoot, dir)
  if (!fs.existsSync(absoluto)) return []
  const saida: string[] = []
  for (const entrada of fs.readdirSync(absoluto, { withFileTypes: true })) {
    if (entrada.isSymbolicLink()) continue
    const relativo = path.posix.join(dir, entrada.name)
    if (entrada.isDirectory()) {
      // A .next antiga da raiz saiu em F; este basename também exclui gerados dos hosts, não dados-fonte da plataforma.
      if (
        ['node_modules', '__fixtures__', '.next', 'dist'].includes(entrada.name)
      )
        continue
      saida.push(...arquivos(relativo))
    } else if (CODIGO.test(entrada.name) && !TESTE.test(entrada.name))
      saida.push(relativo)
  }
  return saida
}

/** Ocorrências de dados da GB num texto: `[rótulo, trecho]`. */
function ocorrenciasDaGb(texto: string): Array<[string, string]> {
  const achados: Array<[string, string]> = []
  for (const [rotulo, padrao] of DADOS_DA_GB) {
    const achado = texto.match(padrao)
    if (achado) achados.push([rotulo, achado[0]])
  }
  return achados
}

describe('T12: sem dados da GB no código da vitrine, do painel e do app', () => {
  const todos = ROOTS.flatMap(arquivos)

  it('varre os quatro pacotes (nenhuma raiz vazia)', () => {
    for (const root of ROOTS)
      expect(
        todos.filter((file) => file.startsWith(root + '/')).length,
        root
      ).toBeGreaterThan(5)
  })

  it('reconhece cada dado da GB e não acusa a marca do pacote nem nome de outra locadora', () => {
    const amostra =
      'GB LOCAÇÕES | GB Locacoes | locacoesgb.com.br | locacoes_gb | 34.780.330/0001-69 | Heinzelmann | ' +
      '(51) 2313-6262 | (51) 99820-5163 | 5721491678 | ChIJJZbj9_l5GZURSyYQSxkhy8k | -29.9943488 | ' +
      'região de Porto Alegre | Melnick, Cyrela | 10 Anos de Experiência | ' +
      "{ number: '10+' } | +200 Equipamentos Disponíveis | ratingValue: '4.8' | addressRegion: ['RS'] | " +
      'mark: "GB" | 500+ avaliações | Transportadora GB | \'90000-000\''
    expect(ocorrenciasDaGb(amostra).map(([rotulo]) => rotulo)).toEqual(
      DADOS_DA_GB.map(([rotulo]) => rotulo)
    )
    expect(
      ocorrenciasDaGb(
        "import { Button } from '@gb-locacoes/ui' // Locadora Alfa (51) 3000-0000"
      )
    ).toEqual([])
    // Cada fato também aparece sozinho, nas formas em que estava no código.
    for (const [rotulo, texto] of [
      ['cidade de atendimento', 'Entregamos em toda região de Porto Alegre'],
      ['construtoras clientes', 'como Joal Teitelbaum, UMA Incorporadora'],
      ['anos de mercado', 'Há 10 anos oferecendo soluções'],
      ['anos de mercado', 'Mais de 10 anos de experiência no mercado'],
      ['anos de mercado', 'Mais de uma década atendendo o mercado'],
      ['números da empresa', '<div className="text-2xl font-bold">10+</div>'],
      ['números da empresa', '>+200</div>'],
      ['números da empresa', "{ number: '500+', label: 'Projetos' }"],
      // Onda 134: o número fixo junto do rótulo, em qualquer forma.
      ['anos de mercado', '10+ Anos de Experiência'],
      ['anos de mercado', '<div>10 Anos de Experiência</div>'],
      ['frota e números em texto corrido', '+200 Equipamentos Disponíveis'],
      ['frota e números em texto corrido', '50+ Equipamentos Disponíveis'],
      ['frota e números em texto corrido', '500+ Clientes Satisfeitos'],
      ['frota e números em texto corrido', '500+ Projetos Realizados'],
      ['frota e números em texto corrido', '50+ Cidades Atendidas'],
      ['transportadora da GB no frete', "company: 'Transportadora GB',"],
      ['CEP de origem da GB', "const fromCEP = '90000-000'"],
      ['CEP de origem da GB', 'cep: "90000000"'],
      ['nota de avaliação fixa', '<span className="ml-1">4.8</span>'],
      ['nota de avaliação fixa', '<Text>★ 4.8 (127 avaliações)</Text>'],
      ['nota de avaliação fixa', "reviewCount: '124',"],
      ['UF de entrega no JSON-LD', "addressRegion: ['RS'],"],
      // Achado 146: as formas em que a sigla e a nota estavam nas telas de senha e na prévia SEO do painel.
      ['sigla da GB como marca', '    mark: "GB",'],
      [
        'sigla da GB como marca',
        '{shell === "platform" ? PLATFORM.displayName : "GB"}',
      ],
      ['sigla da GB como marca', '<span className="text-2xl">GB</span>'],
      ['nota de avaliação fixa', '>\n   4.9 · 500+ avaliações\n  </span>'],
      ['contagem fixa de avaliações', '4.9 · 500+ avaliações'],
      ['contagem fixa de avaliações', '<span>(127 avaliações)</span>'],
    ] as const)
      expect(
        ocorrenciasDaGb(texto).map(([achado]) => achado),
        texto
      ).toContain(rotulo)
    // Contagem dinâmica de avaliações reais, prazo de 10 anos no calendário e UF de exemplo não são fatos da GB.
    for (const texto of [
      'averageRating:reviewCount?total/reviewCount:0}',
      "({reviewCount}{' '}",
      '// Data máxima (10 anos no futuro)',
      'placeholder="RS"',
      'z-10 px-50',
      // Unidade de tamanho de arquivo, pacote e autoria do código não são a marca; contagem real vem de variável.
      "const sizes = ['B', 'KB', 'MB', 'GB']",
      "import { Card } from '@gb-locacoes/ui'",
      ' * @author GB-Locações Team',
      '{reviewCount} avaliações',
      '`${total} avaliações`',
      // Onda 134: o rótulo do modelo com o número da própria locadora não é fato da GB.
      'Anos de Experiência',
      '`${anos} Anos de Experiência`',
      '{comMais(conteudo.experienceYears)} Anos de Experiência',
      '`${maisAntes(frota)} Equipamentos Disponíveis`',
      'Equipamentos Disponíveis',
      'CEP 90000000 de exemplo sem aspas',
    ])
      expect(ocorrenciasDaGb(texto), texto).toEqual([])
  })

  it('nenhum arquivo fora das pendências declaradas tem dado da GB', () => {
    const violacoes = todos
      .filter((file) => !(file in PENDENTES))
      .map(
        (file) =>
          [
            file,
            ocorrenciasDaGb(fs.readFileSync(path.join(repoRoot, file), 'utf8')),
          ] as const
      )
      .filter(([, achados]) => achados.length > 0)
    expect(violacoes).toEqual([])
  })

  it('cada pendência existe, tem motivo e ainda tem dado da GB (a lista só encolhe)', () => {
    for (const [file, motivo] of Object.entries(PENDENTES)) {
      expect(motivo.length, file).toBeGreaterThan(20)
      expect(todos, file).toContain(file)
      expect(
        ocorrenciasDaGb(fs.readFileSync(path.join(repoRoot, file), 'utf8'))
          .length,
        file
      ).toBeGreaterThan(0)
    }
  })
})
