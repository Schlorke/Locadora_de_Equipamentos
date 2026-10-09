import { useMemo } from 'react'
import { useScopedApiClient } from '../../../shared/api'
import { createLogisticsApi } from '../api/logistics'
const stale = () =>
  Object.assign(new Error('Seleção encerrada.'), { name: 'AbortError' })
export function useLogisticsPhotos(
  id: string | undefined,
  editing: boolean,
  pick?: () => Promise<FormData[]>
) {
  const client = useScopedApiClient(JSON.stringify([id, editing])),
    api = useMemo(() => createLogisticsApi(client), [client])
  const check = () => {
    if (!editing || !client.isCurrent()) throw stale()
  }
  const upload = async (body: FormData) => {
    check()
    const response = await api.upload(body)
    check()
    if (!response.ok) throw new Error(response.data?.error || 'Erro no upload')
    if (typeof response.data?.url !== 'string' || !response.data.url)
      throw new Error('Resposta inválida do upload')
    return response.data.url
  }
  const choose = async (remaining: number) => {
    check()
    if (!pick) return []
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
  return { upload, choose: pick ? choose : undefined }
}
