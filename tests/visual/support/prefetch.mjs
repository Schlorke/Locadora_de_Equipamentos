/**
 * Only the explicit production prefetch variant emitted by the installed Next
 * client. A generic RSC request or query marker never qualifies on its own.
 * Headers are the lowercase keys returned by Playwright Request.headers().
 * @param {{ production: boolean, method: string, resourceType: string, isNavigationRequest: boolean, pathname: string, headers: Record<string, string> }} request
 */
export function isVisualRscPrefetch(request) {
  return (
    request.production === true &&
    request.method === 'GET' &&
    request.resourceType === 'fetch' &&
    request.isNavigationRequest === false &&
    request.pathname !== '/api' &&
    !request.pathname.startsWith('/api/') &&
    request.pathname !== '/_next' &&
    !request.pathname.startsWith('/_next/') &&
    request.headers.rsc === '1' &&
    request.headers['next-router-prefetch'] === '1'
  )
}
