import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { prepareUploadedImage } from '../../packages/backend/src/modules/catalog/image-upload'

describe('image content validation', () => {
  it('rejects executable content disguised as an image', async () => {
    const file = new File(['<script>alert(1)</script>'], 'fake.png', {
      type: 'image/png',
    })
    await expect(prepareUploadedImage(file)).rejects.toThrow()
  })
  it('derives output format from validated content, never the filename', async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    const result = await prepareUploadedImage(
      new File([new Uint8Array(bytes)], 'malicious.html', { type: 'image/png' })
    )
    expect(result.extension).toBe('webp')
    expect((await sharp(result.buffer).metadata()).format).toBe('webp')
  })
  it('removes scripts and remote links from SVG', async () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><image href="https://example.test/tracker"/><rect width="10" height="10" onload="alert(1)" fill="red"/></svg>'
    const result = await prepareUploadedImage(
      new File([source], 'icon.svg', { type: 'image/svg+xml' })
    )
    expect(result.buffer.toString()).not.toMatch(/script|onload|https:/)
    expect(result.extension).toBe('svg')
  })
})
