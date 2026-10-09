#!/usr/bin/env node

/**
 * Script para verificar se o Prisma está funcionando corretamente
 * Executa antes dos testes e builds para garantir que não há problemas
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

console.log('🔍 Verificando configuração do Prisma...')

try {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL nÆo est  definido no ambiente')
  }
  // Verificar se o schema existe
  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
  if (!existsSync(schemaPath)) {
    throw new Error('Schema do Prisma não encontrado em prisma/schema.prisma')
  }
  console.log('✅ Schema do Prisma encontrado')

  // Verificar se o cliente foi gerado
  const clientPath = join(
    process.cwd(),
    'node_modules',
    '.prisma',
    'client',
    'index.d.ts'
  )
  if (!existsSync(clientPath)) {
    console.log('⚠️ Cliente do Prisma não encontrado, gerando...')
    execSync('npx prisma generate', { stdio: 'inherit' })
  } else {
    console.log('✅ Cliente do Prisma encontrado')
  }

  // Verificar se o PrismaClient pode ser importado especificamente
  console.log('🧪 Testando importação específica do PrismaClient...')

  // Criar um arquivo temporário para testar apenas o Prisma
  const testFile = `
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
console.log('PrismaClient importado com sucesso');
  `

  const fs = await import('fs')
  const tempFile = join(process.cwd(), 'temp-prisma-test.ts')
  fs.writeFileSync(tempFile, testFile)

  try {
    execSync(`npx tsc --noEmit --skipLibCheck ${tempFile}`, { stdio: 'pipe' })
    console.log('✅ Importação do PrismaClient funcionando')
  } catch {
    // Se falhar, tentar gerar novamente
    console.log('⚠️ Tentando regenerar o cliente do Prisma...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    execSync(`npx tsc --noEmit --skipLibCheck ${tempFile}`, { stdio: 'pipe' })
    console.log('✅ Importação do PrismaClient funcionando após regeneração')
  } finally {
    // Limpar arquivo temporário
    if (existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
    }
  }

  console.log('🎉 Verificação do Prisma concluída com sucesso!')
  process.exit(0)
} catch (error) {
  console.error('❌ Erro na verificação do Prisma:', error.message)
  process.exit(1)
}
