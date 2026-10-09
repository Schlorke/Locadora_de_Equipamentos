import { requireCronAuthorization as sharedCronAuthorization } from '@gb-locacoes/backend/http'
export { secretsMatch } from '@gb-locacoes/backend/identity'
export function requireCronAuthorization(request: Request): Response | null {
  return sharedCronAuthorization(request)
}
