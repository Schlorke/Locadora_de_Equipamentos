export async function fetchAddressByCEP(cep: string): Promise<{
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
} | null> {
  const cleanCEP = cep.replace(/\D/g, '')
  if (cleanCEP.length !== 8) return null

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
    const data = await response.json()

    if (data.erro) return null

    return {
      logradouro: data.logradouro || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || '',
    }
  } catch {
    return null
  }
}
