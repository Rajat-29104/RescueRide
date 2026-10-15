import { handleLocalRequestStatus } from '@/lib/localRequestStatusApi'

export async function PATCH(req, { params }) {
  const { id } = await params
  return handleLocalRequestStatus(req, id)
}
