#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import path from 'path'

const rootDir = process.cwd()

const indexFiles = [
  'docs/README.md',
  'docs/ai/README.md',
  'docs/ai/context-map.md',
  'docs/features/INDEX.md',
  'docs/issues/known-issues.index.md',
  'docs/architecture/diagrams/README.md',
  'docs/ai/prompt-templates/README.md',
]

const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g
const inlineCodeRegex = /`([^`]+)`/g
const docPathPattern = /^(docs\/|\.\/|\.\.\/).+\.(md|mermaid)$/
const docDirPattern = /^(docs\/|\.\/|\.\.\/).+\/$/

const missing = []

function normalizeTarget(target) {
  const cleaned = target.split('#')[0].split('?')[0].trim()
  if (!cleaned) {
    return ''
  }
  return cleaned
}

function resolveTarget(target, baseDir) {
  if (target.startsWith('docs/')) {
    return path.resolve(rootDir, target)
  }
  if (target.startsWith('/')) {
    return path.resolve(rootDir, target.slice(1))
  }
  return path.resolve(baseDir, target)
}

function isPlaceholder(target) {
  return target.includes('<') || target.includes('>') || target.includes('*')
}

function recordMissing(sourceFile, target) {
  missing.push({ sourceFile, target })
}

function checkTarget(sourceFile, baseDir, target) {
  if (!target || target.startsWith('http') || target.startsWith('mailto:')) {
    return
  }
  if (target.startsWith('#')) {
    return
  }

  const normalized = normalizeTarget(target)
  if (!normalized) {
    return
  }
  if (isPlaceholder(normalized)) {
    return
  }

  const resolved = resolveTarget(normalized, baseDir)
  if (!existsSync(resolved)) {
    recordMissing(sourceFile, normalized)
  }
}

function checkInlineCode(sourceFile, baseDir, snippet) {
  const tokens = snippet.split(/\s+/).filter(Boolean)
  for (let token of tokens) {
    token = token.replace(/[),.;:]+$/, '')
    if (!docPathPattern.test(token) && !docDirPattern.test(token)) {
      continue
    }
    const normalized = normalizeTarget(token)
    if (isPlaceholder(normalized)) {
      continue
    }
    const resolved = resolveTarget(normalized, baseDir)
    if (!existsSync(resolved)) {
      recordMissing(sourceFile, normalized)
    }
  }
}

for (const file of indexFiles) {
  const filePath = path.resolve(rootDir, file)
  if (!existsSync(filePath)) {
    continue
  }

  const content = readFileSync(filePath, 'utf8')
  const baseDir = path.dirname(filePath)

  let match
  while ((match = linkRegex.exec(content)) !== null) {
    checkTarget(file, baseDir, match[1])
  }

  while ((match = inlineCodeRegex.exec(content)) !== null) {
    checkInlineCode(file, baseDir, match[1])
  }
}

if (missing.length > 0) {
  console.error('Docs index/link validation failed.')
  for (const item of missing) {
    console.error(`- Missing: ${item.target} (from ${item.sourceFile})`)
  }
  process.exit(1)
}

console.log('Docs index/link validation passed.')
