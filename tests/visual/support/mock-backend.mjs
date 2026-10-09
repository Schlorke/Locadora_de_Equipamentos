#!/usr/bin/env node
// Backend simulado da linha de base visual: substitui `WEB_API_ORIGIN` para o `next dev` do host web.
// Atende só o que o servidor lê (layout da locadora, configurações públicas e detalhe do equipamento no SSR) e os
// arquivos de public/ que o next.config encaminha ao backend (`beforeFiles`). Sem banco, sem rede externa: as
// respostas vêm de fixtures.mjs. As chamadas do navegador nunca chegam aqui (o spec as atende com page.route).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BACKEND_PORT } from './env.mjs'
import { apiResponse } from './fixtures.mjs'

const publicDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'public'
)
const TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.js': 'text/javascript',
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  response.end(JSON.stringify(body))
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://backend.invalid')
  const pathname = decodeURIComponent(url.pathname)
  if (pathname === '/__visual/health')
    return sendJson(response, 200, { ok: true })
  if (pathname.startsWith('/api/')) {
    const answer = apiResponse({
      method: request.method ?? 'GET',
      pathname,
      session: 'anonymous',
    })
    if (answer)
      return sendJson(response, answer.status, answer.body, answer.headers)
    process.stdout.write(
      `[visual-backend] sem fixture: ${request.method} ${pathname}${url.search}\n`
    )
    return sendJson(response, 404, { error: 'visual-backend: sem fixture' })
  }
  // Arquivos de public/ (somente leitura, sem sair da pasta; modelos 3D ficam de fora de propósito).
  const file = path.resolve(publicDir, '.' + pathname)
  if (
    !file.startsWith(publicDir + path.sep) ||
    pathname.startsWith('/models/') ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    response.writeHead(404, { 'content-type': 'text/plain' })
    return response.end('not found')
  }
  response.writeHead(200, {
    'content-type':
      TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  fs.createReadStream(file).pipe(response)
})

server.listen(BACKEND_PORT, '127.0.0.1', () =>
  process.stdout.write(
    `[visual-backend] ouvindo em 127.0.0.1:${BACKEND_PORT}\n`
  )
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)))
