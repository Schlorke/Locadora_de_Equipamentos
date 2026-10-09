// Marca da locadora a partir do nome do cartão público. Funções puras, sem 'use client': a página de pausa (Server
// Component do host web) as chama no servidor (achados 142 e 143).

/** Identidade pública da locadora (cartão): nome, cidade, UF e logo da própria locadora (T12). */
export interface IdentidadePublica {
  readonly nome: string
  readonly cidade: string | null
  readonly uf: string | null
  readonly logoUrl: string | null
}

/**
 * Sigla da marca quando não há logo: a primeira palavra quando tem até 3 letras, senão as iniciais das duas primeiras
 * (a mesma regra da marca dos e-mails, `normalizeEmailBranding`).
 */
export function siglaDaLocadora(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = palavras[0]
  if (!primeira) return ''
  const sigla =
    primeira.length <= 3
      ? primeira
      : palavras
          .slice(0, 2)
          .map((palavra) => palavra[0])
          .join('')
  return sigla.toUpperCase()
}

/**
 * Ano do aviso de copyright do modelo de site: o texto que a vitrine sempre mostrou ("© 2024 <nome>"). É texto do
 * modelo, não dado de uma locadora; mantido para o site de quem já estava no ar não mudar (achado 143).
 */
export const ANO_DO_COPYRIGHT = 2024

/** Aviso de copyright do rodapé com o nome da própria locadora; sem nome, sem marca de ninguém. */
export function copyrightDaLocadora(nome: string | null | undefined): string {
  const marca = nome?.trim()
  return marca
    ? `© ${ANO_DO_COPYRIGHT} ${marca}. Todos os direitos reservados.`
    : 'Todos os direitos reservados.'
}

/** Marca das telas de acesso da vitrine (entrar, login, cadastro): sigla e rodapé da própria locadora. */
export function marcaDoAcesso(identidade: IdentidadePublica | null): {
  sigla: string
  rodape: string
} {
  if (!identidade) return { sigla: '', rodape: 'Sistema de Acesso' }
  return {
    sigla: siglaDaLocadora(identidade.nome),
    rodape: `© ${ANO_DO_COPYRIGHT} ${identidade.nome} - Sistema de Acesso`,
  }
}
