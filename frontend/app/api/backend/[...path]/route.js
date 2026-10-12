import { NextResponse } from 'next/server'

const routeMethods = new Map([
  ['requests', new Set(['GET', 'POST'])],
  ['vehicles', new Set(['GET', 'POST'])],
  ['search', new Set(['GET'])],
  ['mechanics/available', new Set(['GET'])],
  ['profile/preferences', new Set(['GET', 'PUT'])],
  ['profile/change-requests', new Set(['GET', 'POST'])],
  ['safety/emergency-contacts', new Set(['GET', 'POST'])],
  ['safety/sos', new Set(['POST'])],
  ['reports', new Set(['GET', 'POST'])],
  ['admin/stats', new Set(['GET'])],
  ['admin/requests', new Set(['GET'])],
  ['admin/mechanics', new Set(['GET', 'PATCH'])],
  ['admin/users', new Set(['GET', 'DELETE'])],
  ['admin/incidents', new Set(['GET', 'PATCH'])],
  ['requests/status', new Set(['PATCH'])],
  ['requests/rate', new Set(['PATCH'])],
])

function isAllowedRoute(route, method) {
  if (routeMethods.get(route)?.has(method)) return true
  if (['GET', 'PATCH', 'DELETE'].includes(method) && /^vehicles\/[0-9a-f-]{36}$/.test(route)) return true
  if (method === 'GET' && /^requests\/[0-9a-f-]{36}$/.test(route)) return true
  if (method === 'PATCH' && /^requests\/[0-9a-f-]{36}\/status$/.test(route)) return true
  if (['GET', 'POST'].includes(method) && /^requests\/[0-9a-f-]{36}\/messages$/.test(route)) return true
  return false
}

async function proxyRequest(request, { params }) {
  const { path = [] } = await params
  const route = path.join('/')

  if (!isAllowedRoute(route, request.method)) {
    return NextResponse.json({ error: 'Backend route is not available through this proxy.' }, { status: 404 })
  }

  const backendUrl = process.env.RESCUERIDE_BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ error: 'The RescueRide backend URL is not configured.' }, { status: 503 })
  }

  let targetUrl
  try {
    const baseUrl = new URL(backendUrl)
    if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('Unsupported protocol')
    targetUrl = new URL(`/api/${route}`, baseUrl)
  } catch {
    return NextResponse.json({ error: 'The configured RescueRide backend URL is invalid.' }, { status: 500 })
  }

  targetUrl.search = new URL(request.url).search
  const headers = new Headers()
  const cookie = request.headers.get('cookie')
  const contentType = request.headers.get('content-type')

  if (cookie) headers.set('cookie', cookie)
  if (contentType) headers.set('content-type', contentType)

  try {
    const hasBody = !['GET', 'HEAD'].includes(request.method)
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
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
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
