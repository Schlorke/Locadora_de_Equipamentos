/**
 * Script para otimizar imagens existentes no Supabase Storage
 *
 * Este script:
 * 1. Lista todas as imagens JPEG/PNG no bucket
 * 2. Baixa cada imagem
 * 3. Otimiza (converte para WebP, redimensiona, comprime)
 * 4. Faz upload da versão otimizada
 * 5. Remove a imagem original (ou mantém como backup)
 *
 * Uso:
 *   pnpm tsx scripts/optimize-existing-images.ts [--dry-run] [--folder=equipments]
 *
 * Requisitos:
 *   - Arquivo .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

// Carregar variáveis de ambiente (Next.js não carrega .env.local em scripts standalone)
import 'dotenv/config'

import sharp from 'sharp'
import {
  createSupabaseAdminClient,
  getDatabaseRuntime,
} from '@gb-locacoes/backend/runtime'

const { prisma } = getDatabaseRuntime()

// Verificar variáveis de ambiente antes de importar supabase-admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ Erro: Variáveis de ambiente do Supabase não configuradas!\n'
  )
  console.error(
    'Por favor, configure as seguintes variáveis no arquivo .env.local:'
  )
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY\n')
  console.error('Exemplo:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"')
  console.error('  SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"\n')
  console.error('💡 Dica: O arquivo .env.local deve estar na raiz do projeto\n')
  process.exit(1)
}

const supabaseAdmin = createSupabaseAdminClient()

const BUCKET_NAME = 'gb-locacoes-images'
const MAX_WIDTH = 1920
const WEBP_QUALITY = 85

interface ImageFile {
  name: string
  path: string
  size: number
  mimeType: string
}

interface OptimizationResult {
  path: string
  originalSize: number
  optimizedSize: number
  reduction: number
  success: boolean
  error?: string
  newPath?: string
  oldUrl?: string
  newUrl?: string
  databaseUpdated?: boolean
}

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const folderArg = args.find((arg) => arg.startsWith('--folder='))
const targetFolder = folderArg ? folderArg.split('=')[1] : undefined

console.log('🖼️  Otimizador de Imagens Existentes')
console.log('=====================================\n')

if (dryRun) {
  console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita\n')
}

if (targetFolder) {
  console.log(`📁 Processando apenas pasta: ${targetFolder}\n`)
}

/**
 * Lista todas as imagens no bucket recursivamente
 */
async function listImages(folder?: string): Promise<ImageFile[]> {
  console.log('📋 Listando imagens...')

  const images: ImageFile[] = []
  const foldersToProcess: string[] = folder ? [folder] : ['equipments', 'logos']

  // Processar todas as pastas recursivamente
  while (foldersToProcess.length > 0) {
    const currentFolder = foldersToProcess.shift()!

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(currentFolder, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) {
      // Se a pasta não existir, apenas avisar e continuar
      if (
        error.message?.includes('not found') ||
        error.message?.includes('404')
      ) {
        console.warn(`⚠️  Pasta ${currentFolder} não encontrada, pulando...`)
        continue
      }
      throw new Error(`Erro ao listar pasta ${currentFolder}: ${error.message}`)
    }

    if (!data) {
      continue
    }

    for (const item of data) {
      // Se for uma pasta (não tem metadata.size), adicionar à lista para processar
      if (!item.metadata || !item.metadata.size) {
        // É uma subpasta, adicionar para processar depois
        const subfolderPath = `${currentFolder}/${item.name}`
        foldersToProcess.push(subfolderPath)
        continue
      }

      // É um arquivo - verificar se é JPEG ou PNG
      const fileName = item.name.toLowerCase()
      if (
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png')
      ) {
        images.push({
          name: item.name,
          path: `${currentFolder}/${item.name}`,
          size: item.metadata.size || 0,
          mimeType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
        })
      }
    }
  }

  console.log(`✅ Encontradas ${images.length} imagens para otimizar\n`)
  return images
}

/**
 * Otimiza uma imagem
 */
async function optimizeImage(
  imageBuffer: Buffer,
  _mimeType: string
): Promise<Buffer> {
  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  // Redimensionar se maior que MAX_WIDTH
  let resizedImage = image
  if (metadata.width && metadata.width > MAX_WIDTH) {
    resizedImage = image.resize(MAX_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
  }

  // Converter para WebP
  return await resizedImage
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer()
}

/**
 * Processa uma imagem individual
 */
async function processImage(image: ImageFile): Promise<OptimizationResult> {
  try {
    // Baixar imagem
    const { data: imageData, error: downloadError } =
      await supabaseAdmin.storage.from(BUCKET_NAME).download(image.path)

    if (downloadError || !imageData) {
      return {
        path: image.path,
        originalSize: image.size,
        optimizedSize: 0,
        reduction: 0,
        success: false,
        error: `Erro ao baixar: ${downloadError?.message}`,
      }
    }

    // Converter para Buffer
    const arrayBuffer = await imageData.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)
    const originalSize = originalBuffer.length

    // Otimizar
    const optimizedBuffer = await optimizeImage(originalBuffer, image.mimeType)
    const optimizedSize = optimizedBuffer.length
    const reduction = (1 - optimizedSize / originalSize) * 100

    if (dryRun) {
      return {
        path: image.path,
        originalSize,
        optimizedSize,
        reduction,
        success: true,
      }
    }

    // Gerar novo nome (mesmo nome mas .webp)
    const folder = image.path.includes('/')
      ? image.path.substring(0, image.path.lastIndexOf('/'))
      : ''
    const fileNameWithoutExt = image.name.substring(
      0,
      image.name.lastIndexOf('.')
    )
    const newFileName = `${fileNameWithoutExt}.webp`
    const newPath = folder ? `${folder}/${newFileName}` : newFileName

    // Fazer upload da versão otimizada
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(newPath, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: true, // Substituir se já existir
      })

    if (uploadError) {
      return {
        path: image.path,
        originalSize,
        optimizedSize,
        reduction,
        success: false,
        error: `Erro ao fazer upload: ${uploadError.message}`,
      }
    }

    // Obter URLs (antiga e nova)
    const {
      data: { publicUrl: oldUrl },
    } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(image.path)

    const {
      data: { publicUrl: newUrl },
    } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(newPath)

    // Atualizar URLs no banco de dados
    let databaseUpdated = false
    try {
      // 1. Atualizar URLs na tabela Equipment
      const equipments = await prisma.equipment.findMany({
        select: { id: true, images: true },
      })

      for (const equipment of equipments) {
        if (!equipment.images || equipment.images.length === 0) continue

        // Verificar se a URL antiga está no array
        const hasOldUrl = equipment.images.some((url) => url === oldUrl)

        if (hasOldUrl) {
          // Substituir URL antiga pela nova
          const updatedImages = equipment.images.map((url) =>
            url === oldUrl ? newUrl : url
          )

          await prisma.equipment.update({
            where: { id: equipment.id },
            data: { images: updatedImages },
          })

          databaseUpdated = true
        }
      }

      // 2. Atualizar URLs no heroCarousel da tabela Setting
      const settings = await prisma.setting.findMany({
        select: { id: true, heroCarousel: true },
      })

      for (const setting of settings) {
        if (!setting.heroCarousel) continue

        // heroCarousel é um JSON que pode ser array ou objeto
        let heroCarousel = setting.heroCarousel
        if (typeof heroCarousel !== 'object' || !Array.isArray(heroCarousel)) {
          continue
        }

        let hasUpdated = false
        const updatedHeroCarousel = heroCarousel.map((item: unknown) => {
          // item pode ser string (URL) ou objeto { imageUrl: string, ... }
          if (typeof item === 'string' && item === oldUrl) {
            hasUpdated = true
            return newUrl
          }
          if (typeof item === 'object' && item !== null && 'imageUrl' in item) {
            const itemObj = item as { imageUrl: string; [key: string]: unknown }
            if (itemObj.imageUrl === oldUrl) {
              hasUpdated = true
              return { ...itemObj, imageUrl: newUrl }
            }
          }
          return item
        })

        if (hasUpdated) {
          await prisma.setting.update({
            where: { id: setting.id },
            data: { heroCarousel: updatedHeroCarousel as any },
          })
          databaseUpdated = true
        }
      }
    } catch (dbError) {
      console.warn(
        `⚠️  Aviso: Erro ao atualizar banco de dados para ${image.path}:`,
        dbError
      )
    }

    // IMPORTANTE: Remover arquivo original APÓS upload bem-sucedido
    // Isso garante que sempre há uma versão disponível
    const { error: deleteError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([image.path])

    if (deleteError) {
      console.warn(
        `⚠️  Aviso: Não foi possível remover ${image.path}: ${deleteError.message}. Arquivo otimizado salvo em ${newPath}`
      )
    }

    return {
      path: image.path,
      originalSize,
      optimizedSize,
      reduction,
      success: true,
      newPath,
      oldUrl,
      newUrl,
      databaseUpdated,
    }
  } catch (error) {
    return {
      path: image.path,
      originalSize: image.size,
      optimizedSize: 0,
      reduction: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Formata tamanho em bytes para formato legível
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

/**
 * Função principal
 */
async function main() {
  try {
    // Listar imagens
    const images = await listImages(targetFolder)

    if (images.length === 0) {
      console.log('✅ Nenhuma imagem encontrada para otimizar')
      return
    }

    // Processar cada imagem
    const results: OptimizationResult[] = []
    let processed = 0

    console.log('⚙️  Processando imagens...\n')

    for (const image of images) {
      processed++
      process.stdout.write(
        `[${processed}/${images.length}] Processando ${image.name}... `
      )

      const result = await processImage(image)

      if (result.success) {
        const savings = formatSize(result.originalSize - result.optimizedSize)
        const reduction = result.reduction.toFixed(1)
        const dbStatus = result.databaseUpdated ? ' [DB atualizado]' : ''
        process.stdout.write(
          `✅ ${reduction}% menor (${formatSize(result.originalSize)} → ${formatSize(result.optimizedSize)}, economia: ${savings})${dbStatus}\n`
        )
      } else {
        process.stdout.write(`❌ ${result.error}\n`)
      }

      results.push(result)

      // Pequeno delay para não sobrecarregar o Supabase
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Estatísticas finais
    console.log('\n📊 Estatísticas Finais')
    console.log('======================')

    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)
    const dbUpdated = successful.filter((r) => r.databaseUpdated).length

    const totalOriginalSize = results.reduce(
      (sum, r) => sum + r.originalSize,
      0
    )
    const totalOptimizedSize = successful.reduce(
      (sum, r) => sum + r.optimizedSize,
      0
    )
    const totalSavings = totalOriginalSize - totalOptimizedSize
    const avgReduction =
      successful.reduce((sum, r) => sum + r.reduction, 0) / successful.length

    console.log(`✅ Sucesso: ${successful.length}/${results.length}`)
    console.log(`📊 URLs atualizadas no banco: ${dbUpdated}`)
    console.log(`❌ Falhas: ${failed.length}`)

    if (successful.length > 0) {
      console.log(`\n💾 Tamanhos:`)
      console.log(`   Original: ${formatSize(totalOriginalSize)}`)
      console.log(`   Otimizado: ${formatSize(totalOptimizedSize)}`)
      console.log(`   Economia: ${formatSize(totalSavings)}`)
      console.log(`   Redução média: ${avgReduction.toFixed(1)}%`)
    }

    if (failed.length > 0) {
      console.log(`\n❌ Erros:`)
      failed.forEach((result) => {
        console.log(`   ${result.path}: ${result.error}`)
      })
    }

    if (dryRun) {
      console.log(
        `\n⚠️  MODO DRY-RUN: Execute novamente sem --dry-run para aplicar as alterações`
      )
    } else {
      console.log(`\n✅ Otimização concluída!`)
    }
  } catch (error) {
    console.error('\n❌ Erro fatal:', error)
    process.exit(1)
  }
}

// Executar
main().catch((error) => {
  console.error('Erro não tratado:', error)
  process.exit(1)
})
