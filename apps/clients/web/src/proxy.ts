/**
 * Proxy do host web (docs/architecture/adr-tenant-hosts.md, D2, D4 e D5; tabela 4.2).
 *
 * A decisão (`decide`) é pura: só classifica o Host e o caminho, sem banco. Em host de locadora toda página é
 * reescrita para `/{slug}{caminho}`; no apex, para `/plataforma{caminho}`; todo `/api/*` segue por rewrite externo
 * para `WEB_API_ORIGIN` com o contexto de borda. Única leitura: o modo do site da página da vitrine no cartão público
 * do backend (S13), para entregar a pausa com 503 real. A lógica fica em `host/routing`; aqui só a instância com o
 * ambiente do processo e o `matcher`, que precisa ser um literal constante (análise estática do Next).
 */
import type { NextRequest } from 'next/server'
import { resolveWebPlatformEnv } from '@gb-locacoes/contracts/platform'
import { hostAuthMode } from './host/auth/mode'
import {
  createPlatformProxy,
  type ProxyEnv,
} from './host/routing/platform-proxy'
import { createSiteStateReader } from './host/server/site-state'

let resolved: { readonly env: ProxyEnv | null } | null = null

function processPlatformEnv(): ProxyEnv | null {
  if (resolved === null) {
    try {
      resolved = {
        env: {
          ...resolveWebPlatformEnv(process.env),
          authMode: hostAuthMode(process.env),
        },
      }
    } catch (error) {
      // A mensagem de PlatformEnvError nunca contém valores de segredo.
      console.error(
        '[proxy] ambiente da plataforma inválido; respondendo 503',
        {
          error: error instanceof Error ? error.message : 'unknown',
        }
      )
      resolved = { env: null }
    }
  }
  return resolved.env
}

// Vitrine em pausa (S13): o modo do site vem do cartão público no backend; a página não escolhe o status HTTP.
const platformProxy = createPlatformProxy(
  processPlatformEnv,
  createSiteStateReader()
)

export default function proxy(request: NextRequest) {
  return platformProxy(request)
}

// Nunca exclui por extensão (D4): `/b/equipamentos/x.png` passa pelo proxy e é reescrito para a locadora do Host.
// Os diretórios de public/ (fonts, models, email-templates) são slugs reservados e seguem direto ao public/ do host.
export const config = {
  matcher: [
    '/((?!_next/static/|_next/image|_vercel/|fonts/|models/|email-templates/).*)',
  ],
}
