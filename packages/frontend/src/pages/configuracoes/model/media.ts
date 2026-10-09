export interface SettingsImage {
  multipart: FormData
  type: string
  size: number
}
export type SettingsImagePicker = (
  multiple: boolean
) => Promise<SettingsImage[]>
export function imageValidationError(image: SettingsImage) {
  if (!image.type.startsWith('image/'))
    return 'Por favor, selecione um arquivo de imagem válido.'
  if (image.size > 5 * 1024 * 1024) return 'A imagem deve ter no máximo 5MB.'
  return null
}
