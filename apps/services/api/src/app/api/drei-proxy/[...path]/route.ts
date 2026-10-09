import { createDreiAssetProxy } from '@gb-locacoes/backend/http'
export const GET = createDreiAssetProxy((url, options) => fetch(url, options))
