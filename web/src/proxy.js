import { NextResponse } from 'next/server'

const SESSION_COOKIE = 'roadrescue_session'

export function proxy(request) {
  const { pathname } = request.nextUrl
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  if (isDashboardRoute && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
