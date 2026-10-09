import sharp from 'sharp'
import DOMPurify from 'isomorphic-dompurify'

export class InvalidImageError extends Error {}
const formats: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}
export async function prepareUploadedImage(file: File) {
  const expected = formats[file.type]
  if (!expected || file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new InvalidImageError(
      'Envie uma imagem JPG, PNG, WebP, GIF ou SVG de até 5MB'
    )
  }
  let source = Buffer.from(await file.arrayBuffer())
  if (expected === 'svg') {
    const clean = DOMPurify.sanitize(source.toString('utf8'), {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: [
        'foreignObject',
        'script',
        'style',
        'iframe',
        'image',
        'a',
        'animate',
        'set',
        'animateMotion',
        'animateTransform',
      ],
      FORBID_ATTR: ['style', 'href', 'xlink:href'],
      RETURN_DOM_FRAGMENT: true,
    })
    for (const element of clean.querySelectorAll('*')) {
      for (const attribute of Array.from(element.attributes)) {
        if (
          /url\(/i.test(attribute.value) &&
          !/^url\(\s*['"]?#[A-Za-z0-9_-]+['"]?\s*\)$/.test(attribute.value)
        )
          element.removeAttribute(attribute.name)
      }
    }
    source = Buffer.from(clean.querySelector('svg')?.outerHTML || '')
  }
  try {
    const image = sharp(source, { limitInputPixels: 25_000_000 })
    const metadata = await image.metadata()
    if (
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height * (metadata.pages ?? 1) > 25_000_000
    ) {
      throw new InvalidImageError(
        'O conteúdo não corresponde ao tipo da imagem'
      )
    }
    const optimized = expected === 'jpeg' || expected === 'png'
    if (optimized) {
      const buffer = await image
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer()
      return { buffer, extension: 'webp', contentType: 'image/webp', optimized }
    }
    // Decode once to reject truncated raster files; preserve animations and vectors.
    if (expected !== 'svg')
      await sharp(source, { limitInputPixels: 25_000_000 }).raw().toBuffer()
    return {
      buffer: source,
      extension: expected,
      contentType: file.type,
      optimized,
    }
  } catch (error) {
    if (error instanceof InvalidImageError) throw error
    throw new InvalidImageError('Arquivo de imagem inválido')
  }
}
