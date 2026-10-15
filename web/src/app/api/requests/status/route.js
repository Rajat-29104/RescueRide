import { handleLocalRequestStatus } from '@/lib/localRequestStatusApi'

export async function PATCH(req) {
  let body
  try {
    body = await req.clone().json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  return handleLocalRequestStatus(req, body.requestId)
}
