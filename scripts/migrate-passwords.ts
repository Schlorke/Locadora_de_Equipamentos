/**
 * Utilitário histórico de migração de senhas
 *
 * Este script converte registros de senha em texto puro para bcrypt.
 * A autenticação atual de packages/backend/src/modules/identity/legacy-credentials.ts
 * verifica bcrypt; o fallback antigo de texto puro já foi retirado.
 *
 * IMPORTANTE:
 * - Não é um procedimento validado para o runtime Prisma 7 atual: esta composição
 *   ainda instancia PrismaClient sem adapter, ao contrário de seed/runtime.
 * - Antes de uma operação autorizada, revisar composição, alvo e papel de banco,
 *   obter backup e verificar os contadores de erros e os registros restantes.
 * - Não remover nem afrouxar a verificação bcrypt do serviço de identidade.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Reconhece os prefixos bcrypt preservados pela migração.
 * O prefixo $2a$, $2b$ ou $2y$ não valida sozinho o conteúdo completo do hash.
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
      console.log('✅ Senhas migradas para bcrypt; confira os erros no resumo.')
      console.log(
        '⚠️  Verifique os registros restantes e preserve a validação bcrypt do serviço de identidade.\n'
      )
    } else if (alreadyHashedCount === users.length) {
      console.log(
        '✓ Todos os registros encontrados já têm prefixo bcrypt; nenhuma senha foi regravada.'
      )
      console.log(
        '⚠️  Preserve a validação bcrypt do serviço de identidade; o prefixo sozinho não prova um hash válido.\n'
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
