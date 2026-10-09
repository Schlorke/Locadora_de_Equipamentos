const sharp = require('sharp')
const { readFileSync, writeFileSync, unlinkSync } = require('fs')
const { join } = require('path')

const inputPath = join(process.cwd(), 'public', 'cta-background.jpg')
const outputPath = join(process.cwd(), 'public', 'cta-background-optimized.jpg')

async function optimizeImage() {
  try {
    console.log('🖼️  Otimizando imagem cta-background.jpg...')

    // Ler metadados da imagem original
    const metadata = await sharp(inputPath).metadata()
    console.log(`📊 Dimensões originais: ${metadata.width}x${metadata.height}`)
    console.log(
      `📦 Tamanho original: ${((metadata.size || 0) / 1024 / 1024).toFixed(2)} MB`
    )

    // Otimizar a imagem
    // - Qualidade 85% (mantém excelente qualidade visual, reduz ~50-70% do tamanho)
    // - Progressive JPEG para melhor carregamento progressivo
    // - Redimensionar para máximo 1920px de largura se necessário (suficiente para backgrounds)
    const maxWidth = Math.min(metadata.width || 1920, 1920)

    await sharp(inputPath)
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true,
      })
      .toFile(outputPath)

    // Verificar tamanho do arquivo otimizado
    const optimizedMetadata = await sharp(outputPath).metadata()
    const originalSize = metadata.size || 0
    const optimizedSize = optimizedMetadata.size || 0
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1)

    console.log(`✅ Otimização concluída!`)
    console.log(
      `📦 Tamanho otimizado: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`
    )
    console.log(`📉 Redução: ${reduction}%`)
    console.log(
      `📐 Dimensões finais: ${optimizedMetadata.width}x${optimizedMetadata.height}`
    )

    // Fazer backup do original e substituir
    const backupPath = join(
      process.cwd(),
      'public',
      'cta-background-backup.jpg'
    )
    const originalBuffer = readFileSync(inputPath)
    writeFileSync(backupPath, originalBuffer)
    console.log(`💾 Backup salvo em: cta-background-backup.jpg`)

    // Substituir o arquivo original
    const optimizedBuffer = readFileSync(outputPath)
    writeFileSync(inputPath, optimizedBuffer)
    console.log(`✨ Arquivo otimizado substituiu o original!`)

    // Remover arquivo temporário
    unlinkSync(outputPath)
    console.log(`🧹 Arquivos temporários removidos`)
  } catch (error) {
    console.error('❌ Erro ao otimizar imagem:', error)
    process.exit(1)
  }
}

optimizeImage()
