import { NextResponse } from 'next/server'

/** Isola o serviço do proxy de páginas da raiz. Os handlers validam tenant/borda. */
export function proxy() {
  return NextResponse.next()
}
export const config = { matcher: ['/api/:path*'] }
