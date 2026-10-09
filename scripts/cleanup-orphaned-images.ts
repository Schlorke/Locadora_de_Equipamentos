/**
 * Script para limpar imagens órfãs do Supabase Storage
 *
 * Este script identifica e remove imagens que estão no Storage mas
 * não estão mais referenciadas por nenhum equipamento no banco de dados.
 *
 * Uso:
 *   npx tsx scripts/cleanup-orphaned-images.ts
 *
 * ⚠️ ATENÇÃO: Este script é destrutivo e remove arquivos permanentemente.
 * Recomenda-se fazer backup do Storage antes de executar.
 */

import {
  createSupabaseAdminClient,
  getDatabaseRuntime,
} from '@gb-locacoes/backend/runtime'
import { extractFilePathFromSupabaseUrl } from './ops/storage-utils'

const { prisma } = getDatabaseRuntime()
const supabaseAdmin = createSupabaseAdminClient()

const BUCKET_NAME = 'gb-locacoes-images'

interface FileInfo {
  name: string
  path: string
}

/**
 * Lista todos os arquivos em uma pasta do Storage recursivamente
 */
async function listAllFiles(folder = 'equipments'): Promise<FileInfo[]> {
  const files: FileInfo[] = []
  const folders: string[] = [folder]

  while (folders.length > 0) {
    const currentFolder = folders.shift()!

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(currentFolder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) {
      console.error(`Erro ao listar pasta ${currentFolder}:`, error)
      continue
    }

    if (!data) continue

    for (const item of data) {
      const fullPath = `${currentFolder}/${item.name}`

      if (item.metadata) {
        // É um arquivo
        files.push({
          name: item.name,
          path: fullPath,
        })
      } else {
        // É uma pasta (teoricamente não deveria haver subpastas)
        folders.push(fullPath)
      }
    }
  }

  return files
}

/**
 * Busca todos os caminhos de imagens referenciados no banco de dados
 */
async function getReferencedImagePaths(): Promise<Set<string>> {
  const equipments = await prisma.equipment.findMany({
    select: { images: true },
  })

  const referencedPaths = new Set<string>()

  for (const equipment of equipments) {
    if (equipment.images && Array.isArray(equipment.images)) {
      for (const imageUrl of equipment.images) {
        const filePath = extractFilePathFromSupabaseUrl(imageUrl)
        if (filePath) {
          referencedPaths.add(filePath)
        }
      }
    }
  }

  return referencedPaths
}

async function cleanupOrphanedImages() {
  console.log('🔍 Iniciando limpeza de imagens órfãs...\n')

  try {
    // 1. Listar todos os arquivos no Storage
    console.log('📁 Listando arquivos no Storage...')
    const allFiles = await listAllFiles()
    console.log(`   ✅ Encontrados ${allFiles.length} arquivos no Storage\n`)

    // 2. Buscar todas as imagens referenciadas no banco
    console.log('🗄️  Buscando imagens referenciadas no banco de dados...')
    const referencedPaths = await getReferencedImagePaths()
    console.log(
      `   ✅ Encontradas ${referencedPaths.size} imagens referenciadas\n`
    )

    // 3. Identificar imagens órfãs
    const orphanedFiles = allFiles.filter(
      (file) => !referencedPaths.has(file.path)
    )

    console.log(`🔎 Análise completa:\n`)
    console.log(`   • Total de arquivos no Storage: ${allFiles.length}`)
    console.log(`   • Imagens referenciadas: ${referencedPaths.size}`)
    console.log(`   • Imagens órfãs encontradas: ${orphanedFiles.length}\n`)

    if (orphanedFiles.length === 0) {
      console.log('✅ Nenhuma imagem órfã encontrada! Tudo limpo.')
      return
    }

    // 4. Mostrar preview das imagens órfãs
    console.log('📋 Imagens órfãs que serão removidas:\n')
    orphanedFiles.slice(0, 10).forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.path}`)
    })
    if (orphanedFiles.length > 10) {
      console.log(`   ... e mais ${orphanedFiles.length - 10} arquivo(s)\n`)
    }

    // 5. Remover imagens órfãs
    console.log(
      `\n🗑️  Removendo ${orphanedFiles.length} imagem(ns) órfã(s)...\n`
    )

    const pathsToRemove = orphanedFiles.map((file) => file.path)

    // Remover em lotes de 50 para evitar sobrecarga
    const batchSize = 50
    let removed = 0
    let failed = 0

    for (let i = 0; i < pathsToRemove.length; i += batchSize) {
      const batch = pathsToRemove.slice(i, i + batchSize)

      const { error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove(batch)

      if (error) {
        console.error(
          `   ❌ Erro ao remover lote ${Math.floor(i / batchSize) + 1}:`,
          error.message
        )
        failed += batch.length
      } else {
        removed += batch.length
        console.log(
          `   ✅ Lote ${Math.floor(i / batchSize) + 1}: ${batch.length} arquivo(s) removido(s)`
        )
      }
    }

    console.log(`\n📊 Resultado final:\n`)
    console.log(`   ✅ Removidos: ${removed}`)
    console.log(`   ❌ Falhas: ${failed}`)
    console.log(`\n✅ Limpeza concluída!`)
  } catch (error) {
    console.error('\n❌ Erro durante a limpeza:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  cleanupOrphanedImages()
    .then(() => {
      console.log('\n✨ Script finalizado com sucesso!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Erro fatal:', error)
      process.exit(1)
    })
}

export { cleanupOrphanedImages }
