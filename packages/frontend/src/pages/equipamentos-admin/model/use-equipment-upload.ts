'use client'
import type { createAdminEquipmentsApi } from '../api/equipments'
import type { useScopedApiClient } from '../../../shared/api'
type Api = ReturnType<typeof createAdminEquipmentsApi>
type Client = ReturnType<typeof useScopedApiClient>
const stale = () =>
  Object.assign(new Error('Escopo encerrado.'), { name: 'AbortError' })
export function useEquipmentUpload(
  api: Api,
  client: Client,
  revision: () => number = () => 0
) {
  return async (multipart: FormData) => {
    const cycle = revision()
    const check = () => {
      if (!client.isCurrent() || cycle !== revision()) throw stale()
    }
    check()
    const response = await api.upload(multipart)
    check()
    if (!response.ok) throw new Error(response.data?.error || 'Erro no upload')
    if (typeof response.data?.url !== 'string' || !response.data.url)
      throw new Error('Resposta inválida do upload')
    return response.data.url
  }
}
export async function pickEquipmentImages(
  pick: () => Promise<FormData[]>,
  upload: (body: FormData) => Promise<string>,
  remaining: number,
  isCurrent: () => boolean
) {
  const check = () => {
    if (!isCurrent()) throw stale()
  }
  check()
  const files = await pick()
  check()
  if (files.length > remaining)
    throw new Error('Quantidade de imagens excede o limite disponível.')
  const urls: string[] = []
  for (const file of files) {
    check()
    urls.push(await upload(file))
    check()
  }
  return urls
}
