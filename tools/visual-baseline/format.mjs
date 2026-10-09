// Formato dos arquivos da linha de base visual (tests/visual/baseline/<viewport>/<cenário>.json).
// Os estilos repetidos viram uma tabela (`styles`) e cada elemento aponta para ela; uma linha por elemento, para
// que o diff do Git mostre exatamente o elemento que mudou. Lido e gravado só por aqui.
import fs from 'node:fs'
import path from 'node:path'

const line = (value) => JSON.stringify(value)

/** Grava `data` ({ version, scenario, viewport, url, captures, unmappedApis }) com a tabela de estilos. */
export function writeCaptureFile(file, data) {
  const styles = []
  const index = new Map()
  const ref = (style) => {
    const sorted = Object.fromEntries(
      Object.keys(style)
        .sort()
        .map((key) => [key, style[key]])
    )
    const id = line(sorted)
    if (!index.has(id)) {
      index.set(id, styles.length)
      styles.push(sorted)
    }
    return index.get(id)
  }
  const elements = (list) =>
    list.map(([key, label, style]) => [key, label, ref(style)])
  const captures = Object.entries(data.captures).map(([name, capture]) => {
    const body =
      capture.kind === 'delta'
        ? {
            kind: 'delta',
            of: capture.of,
            changed: elements(capture.changed),
            removed: capture.removed,
          }
        : { kind: capture.kind, elements: elements(capture.elements) }
    return [name, body]
  })
  const out = []
  out.push('{')
  out.push(`  "version": ${line(data.version)},`)
  out.push(`  "scenario": ${line(data.scenario)},`)
  out.push(`  "viewport": ${line(data.viewport)},`)
  out.push(`  "url": ${line(data.url)},`)
  out.push(`  "unmappedApis": ${line(data.unmappedApis ?? [])},`)
  out.push(`  "unstableWaits": ${line(data.unstableWaits ?? 0)},`)
  out.push('  "styles": [')
  styles.forEach((style, i) =>
    out.push(`    ${line(style)}${i < styles.length - 1 ? ',' : ''}`)
  )
  out.push('  ],')
  out.push('  "captures": {')
  captures.forEach(([name, body], i) => {
    out.push(`    ${line(name)}: {`)
    out.push(`      "kind": ${line(body.kind)},`)
    const list = (label, items, last) => {
      out.push(`      ${line(label)}: [`)
      items.forEach((item, j) =>
        out.push(`        ${line(item)}${j < items.length - 1 ? ',' : ''}`)
      )
      out.push(`      ]${last ? '' : ','}`)
    }
    if (body.kind === 'delta') {
      out.push(`      "of": ${line(body.of)},`)
      list('changed', body.changed, false)
      list('removed', body.removed, true)
    } else list('elements', body.elements, true)
    out.push(`    }${i < captures.length - 1 ? ',' : ''}`)
  })
  out.push('  }')
  out.push('}')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, out.join('\n') + '\n')
}

/** Lê um arquivo e devolve as capturas com os estilos resolvidos (o inverso de writeCaptureFile). */
export function readCaptureFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (
    data.version !== 1 ||
    !Array.isArray(data.styles) ||
    typeof data.captures !== 'object'
  )
    throw new Error(`${file}: formato de linha de base desconhecido`)
  if (!data.captures || !Object.keys(data.captures).length)
    throw new Error(`${file}: arquivo sem capturas`)
  const style = (id) => {
    if (!Number.isInteger(id) || !data.styles[id])
      throw new Error(`${file}: estilo ${id} inexistente`)
    return data.styles[id]
  }
  const elements = (list) =>
    list.map(([key, label, id]) => [key, label, style(id)])
  const captures = {}
  for (const [name, capture] of Object.entries(data.captures)) {
    captures[name] =
      capture.kind === 'delta'
        ? {
            kind: 'delta',
            of: capture.of,
            changed: elements(capture.changed),
            removed: capture.removed,
          }
        : { kind: capture.kind, elements: elements(capture.elements) }
  }
  return {
    version: data.version,
    scenario: data.scenario,
    viewport: data.viewport,
    url: data.url,
    unmappedApis: data.unmappedApis ?? [],
    unstableWaits: data.unstableWaits ?? 0,
    captures,
  }
}

/** Todos os arquivos .json de uma pasta de capturas, por `<viewport>/<cenário>` (caminho relativo sem extensão). */
export function listCaptureFiles(dir) {
  const found = {}
  const walk = (current) => {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (entry.name !== 'screenshots') walk(full)
      } else if (entry.name.endsWith('.json')) {
        found[
          path
            .relative(dir, full)
            .split(path.sep)
            .join('/')
            .replace(/\.json$/, '')
        ] = full
      }
    }
  }
  walk(dir)
  return found
}
