/**
 * Script de Migração de Senhas
 *
 * Este script migra senhas armazenadas em texto puro para bcrypt.
 *
 * IMPORTANTE:
 * - Execute este script ANTES de remover o fallback de senhas em texto puro
 * - Este script deve ser executado UMA ÚNICA VEZ
 * - Faça backup do banco de dados antes de executar
 *
 * Uso:
 *   pnpm tsx scripts/migrate-passwords.ts
 *
 * Ou com Node:
 *   node --loader tsx scripts/migrate-passwords.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Verifica se uma string é um hash bcrypt válido
 * Bcrypt hashes sempre começam com $2a$, $2b$, ou $2y$
 */
function isBcryptHash(password: string): boolean {
  return (
    password.startsWith('$2a$') ||
    password.startsWith('$2b$') ||
    password.startsWith('$2y$')
  )
}

/**
 * Migra senhas em texto puro para bcrypt
 */
async function migratePasswords() {
  console.log('🔐 Iniciando migração de senhas...\n')

  try {
    // Buscar todos os usuários com senha
    const users = await prisma.user.findMany({
      where: {
        password: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        password: true,
      },
    })

    console.log(`📊 Total de usuários encontrados: ${users.length}\n`)

    if (users.length === 0) {
      console.log(
        '✅ Nenhum usuário com senha encontrado. Migração não necessária.'
      )
      return
    }

    let migratedCount = 0
    let alreadyHashedCount = 0
    let errorCount = 0

    for (const user of users) {
      if (!user.password) {
        continue
      }

      // Verificar se já é um hash bcrypt
      if (isBcryptHash(user.password)) {
        alreadyHashedCount++
        console.log(`✓ ${user.email}: Senha já está em bcrypt`)
        continue
      }

      // Senha em texto puro - migrar para bcrypt
      try {
        const hashed = bcrypt.hashSync(user.password, 12)

        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        })

        migratedCount++
        console.log(`✅ ${user.email}: Senha migrada para bcrypt`)
      } catch (error) {
        errorCount++
        console.error(`❌ ${user.email}: Erro ao migrar senha:`, error)
      }
    }

    console.log('\n📈 Resumo da Migração:')
    console.log(`   ✅ Migradas: ${migratedCount}`)
    console.log(`   ✓ Já em bcrypt: ${alreadyHashedCount}`)
    console.log(`   ❌ Erros: ${errorCount}`)
    console.log(`   📊 Total processado: ${users.length}\n`)

    if (migratedCount > 0) {
      console.log('✅ Migração concluída com sucesso!')
      console.log(
        '⚠️  Agora você pode remover o fallback de senhas em texto puro de lib/auth.ts\n'
      )
    } else if (alreadyHashedCount === users.length) {
      console.log(
        '✅ Todas as senhas já estão em bcrypt. Migração não necessária.'
      )
      console.log(
        '⚠️  Você pode remover o fallback de senhas em texto puro de lib/auth.ts\n'
      )
    }
  } catch (error) {
    console.error('💥 Erro fatal durante migração:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar migração
migratePasswords()
  .then(() => {
    console.log('✨ Script finalizado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erro não tratado:', error)
    process.exit(1)
  })
