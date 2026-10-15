import { NextResponse } from 'next/server'
import { getAuthenticatedUser, sessionPayload } from '@/lib/localAuth'

export async function GET() {
  return NextResponse.json(sessionPayload(await getAuthenticatedUser()))
}
