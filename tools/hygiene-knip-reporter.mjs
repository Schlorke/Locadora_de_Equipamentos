// Reporter do knip para o gate de higiene (tools/hygiene-check.mjs): imprime em JSON, numa linha, os achados que o
// relatório inclui e as dicas de configuração, que o reporter "json" do knip não entrega.
// Cada achado: { type, file, name? }, com `file` relativo à raiz analisada e em barras "/". `name` é o símbolo
// (export, tipo, membro), a dependência ou o binário; em "files" ele não existe; em "duplicates" junta os nomes
// com "|" na ordem do knip.
import path from 'node:path'

const toPosix = (value) => value.split(path.sep).join('/')

export default function hygieneReporter({
  report,
  issues,
  configurationHints,
  cwd,
}) {
  const relative = (file) =>
    toPosix(path.isAbsolute(file) ? path.relative(cwd, file) : file)
  const findings = []
  for (const [type, included] of Object.entries(report)) {
    if (!included) continue
    for (const records of Object.values(issues[type] ?? {})) {
      for (const issue of Object.values(records)) {
        const file = relative(issue.filePath)
        if (type === 'files') findings.push({ type, file })
        else if (type === 'duplicates' || type === 'cycles')
          findings.push({
            type,
            file,
            name: (issue.symbols ?? [])
              .map((symbol) => symbol.symbol)
              .join('|'),
          })
        else
          findings.push({
            type,
            file,
            name: issue.parentSymbol
              ? `${issue.parentSymbol}.${issue.symbol}`
              : issue.symbol,
          })
      }
    }
  }
  const hints = (configurationHints ?? []).map((hint) => ({
    type: hint.type,
    identifier: String(hint.identifier),
    workspace: hint.workspaceName ?? '.',
    ...(hint.filePath ? { file: relative(hint.filePath) } : {}),
  }))
  process.stdout.write(JSON.stringify({ findings, hints }) + '\n')
}
