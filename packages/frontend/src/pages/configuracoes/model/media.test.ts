import { expect, it } from 'vitest'
import { imageValidationError } from './media'
it('preserva validação de MIME e limite inclusivo de cinco megabytes do logo', () => {
  const image = {
    multipart: new FormData(),
    type: 'image/svg+xml',
    size: 5 * 1024 * 1024,
  }
  expect(imageValidationError(image)).toBeNull()
  expect(imageValidationError({ ...image, size: image.size + 1 })).toBe(
    'A imagem deve ter no máximo 5MB.'
  )
  expect(imageValidationError({ ...image, type: 'text/plain' })).toBe(
    'Por favor, selecione um arquivo de imagem válido.'
  )
})
