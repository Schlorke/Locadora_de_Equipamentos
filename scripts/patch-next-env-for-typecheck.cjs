#!/usr/bin/env node
/**
 * Garante next-env.d.ts antes do type-check (CI não tem o arquivo; Next gera no build).
 * Remove import de routes.d.ts do next-env.d.ts (evita TS1109/TS1160 - known-issue #127).
 * Cross-platform (Windows/Linux/macOS).
 */
const fs = require('fs')
const path = require('path')

const nextEnvPath = path.join(process.cwd(), 'next-env.d.ts')

const defaultContent = [
  '/// <reference types="next" />',
  '/// <reference types="next/image-types/global" />',
  '',
].join('\n')

let content
if (!fs.existsSync(nextEnvPath)) {
  fs.writeFileSync(nextEnvPath, defaultContent)
  content = defaultContent
} else {
  content = fs.readFileSync(nextEnvPath, 'utf8')
}

const importRegex = /import\s+["'].*\.next.*routes\.d\.ts["'];?\s*\n?/g
const newContent = content.replace(importRegex, '')

if (newContent !== content) {
  fs.writeFileSync(nextEnvPath, newContent)
}
