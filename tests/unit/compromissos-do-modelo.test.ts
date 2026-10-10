// Trava dos compromissos comerciais do modelo de site (onda 134, lote vitrine-conteúdo; §2.3 do plano e decisão do dono
// D-E de 2026-10-07). Cada frase que promete uma condição de serviço (gratuidade, prazo, 24 horas, certificação,
// logística, rastreamento, resposta) só pode existir em packages/frontend/src/entities/configuracao/model/compromissos.ts,
// onde fica ligada aos compromissos que a locadora declara no painel (desligados por padrão; CDC art. 30). Uma cópia em
// qualquer outro arquivo da vitrine, do painel, do app ou do domínio mostraria a promessa sem a declaração. As nove
// pendências da parte A saíram na parte B (B7): a vitrine web e o app passaram a ler as frases do modelo. A lista de
// pendências só encolhe: um arquivo novo com frase de compromisso falha aqui.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FRASES_VIGIADAS, VARIANTES_ANTIGAS } from '../helpers/frases-vigiadas'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
/** As mesmas raízes do T12 (tests/unit/t12-sem-dados-da-gb.test.ts). */
const ROOTS = [
  'packages/frontend/src',
  'packages/ui/src',
  'apps/clients/web/src',
  'apps/clients/mobile/src',
  'packages/domain/src',
]
const MODELO =
  'packages/frontend/src/entities/configuracao/model/compromissos.ts'
const TESTE = /\.(test|spec)\.[cm]?[jt]sx?$/
const CODIGO = /\.(?:[cm]?[jt]sx?|json|css)$/

/** Arquivos que ainda trazem frases de compromisso: arquivo → motivo (a lista só encolhe; vazia desde o B7). */
const PENDENTES: Readonly<Record<string, string>> = {}

function arquivos(dir: string): string[] {
  const absoluto = path.join(repoRoot, dir)
  if (!fs.existsSync(absoluto)) return []
  const saida: string[] = []
  for (const entrada of fs.readdirSync(absoluto, { withFileTypes: true })) {
    if (entrada.isSymbolicLink()) continue
    const relativo = path.posix.join(dir, entrada.name)
    if (entrada.isDirectory()) {
      // A .next antiga da raiz saiu em F; este basename também exclui gerados dos hosts da análise de fontes.
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

/** Frases de compromisso encontradas num texto. */
function frasesEm(texto: string): string[] {
  return FRASES_VIGIADAS.filter((frase) => texto.includes(frase))
}

describe('trava das frases de compromisso comercial', () => {
  const todos = ROOTS.flatMap(arquivos)

  it('as frases vigiadas existem no modelo (menos as variantes antigas) e a varredura alcança as raízes', () => {
    const modelo = fs.readFileSync(path.join(repoRoot, MODELO), 'utf8')
    expect(FRASES_VIGIADAS.length).toBeGreaterThan(20)
    for (const frase of FRASES_VIGIADAS)
      if (VARIANTES_ANTIGAS.includes(frase))
        expect(modelo, frase).not.toContain(frase)
      else expect(modelo, frase).toContain(frase)
    expect(todos).toContain(MODELO)
    for (const root of ROOTS)
      expect(
        todos.filter((file) => file.startsWith(root + '/')).length,
        root
      ).toBeGreaterThan(5)
  })

  it('autoteste: uma cópia da frase num arquivo qualquer é acusada; declaração de valor não', () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'compromissos-'))
    try {
      const copia = path.join(pasta, 'Copia.web.tsx')
      fs.writeFileSync(
        copia,
        'export const Selo = () => <span>Suporte 24h</span> // e "Entrega Gratuita"\n'
      )
      expect(frasesEm(fs.readFileSync(copia, 'utf8'))).toEqual([
        'Entrega Gratuita',
        'Suporte 24h',
      ])
      for (const valor of [
        'Atendimento Especializado',
        'Qualidade Garantida',
        'Orçamento Grátis',
        'Solicitar Orçamento Grátis',
        'Pontualidade',
        'Referência em locação de equipamentos',
        'Gerencie seus endereços de entrega e retirada',
      ])
        expect(frasesEm(valor), valor).toEqual([])
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true })
    }
  })

  it('nenhum arquivo fora do modelo e das pendências declaradas traz frase de compromisso', () => {
    const violacoes = todos
      .filter((file) => file !== MODELO && !(file in PENDENTES))
      .map(
        (file) =>
          [
            file,
            frasesEm(fs.readFileSync(path.join(repoRoot, file), 'utf8')),
          ] as const
      )
      .filter(([, frases]) => frases.length > 0)
    expect(violacoes).toEqual([])
  })

  it('cada pendência existe, tem motivo e ainda traz frase (a lista só encolhe)', () => {
    for (const [file, motivo] of Object.entries(PENDENTES)) {
      expect(motivo.length, file).toBeGreaterThan(20)
      expect(todos, file).toContain(file)
      expect(
        frasesEm(fs.readFileSync(path.join(repoRoot, file), 'utf8')).length,
        file
      ).toBeGreaterThan(0)
    }
  })
})
