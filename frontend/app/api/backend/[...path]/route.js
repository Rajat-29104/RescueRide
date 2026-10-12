import { NextResponse } from 'next/server'

const allowedRoutes = new Set(['requests', 'search', 'mechanics/available'])

async function proxyRequest(request, { params }) {
  const { path = [] } = await params
  const route = path.join('/')

  if (!allowedRoutes.has(route) || !['GET', 'POST'].includes(request.method)) {
    return NextResponse.json({ error: 'Backend route is not available through this proxy.' }, { status: 404 })
  }

  const backendUrl = process.env.RESCUERIDE_BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ error: 'The RescueRide backend URL is not configured.' }, { status: 503 })
  }

  let targetUrl
  try {
    targetUrl = new URL(`/api/${route}`, backendUrl)
  } catch {
    return NextResponse.json({ error: 'The configured RescueRide backend URL is invalid.' }, { status: 500 })
  }

  targetUrl.search = new URL(request.url).search
  const headers = new Headers()
  const cookie = request.headers.get('cookie')
  const contentType = request.headers.get('content-type')
  const forwardedFor = request.headers.get('x-forwarded-for')

  if (cookie) headers.set('cookie', cookie)
  if (contentType) headers.set('content-type', contentType)
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor)

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      cache: 'no-store',
    })

    const responseHeaders = new Headers()
    const upstreamContentType = upstream.headers.get('content-type')
    if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType)

    for (const cookieValue of upstream.headers.getSetCookie?.() || []) {
      responseHeaders.append('set-cookie', cookieValue)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[frontend backend proxy]', error)
    return NextResponse.json({ error: 'Could not reach the RescueRide backend. Check that its server is running.' }, { status: 502 })
  }
}

export const GET = proxyRequest
export const POST = proxyRequest
