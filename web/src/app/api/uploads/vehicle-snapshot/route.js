import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MIME_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authenticated.profile.role !== 'driver') {
    return NextResponse.json({ error: 'Only drivers can upload vehicle snapshots.' }, { status: 403 })
  }

  let formData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'A valid multipart image upload is required.' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Select an image to upload.' }, { status: 400 })
  }
  const extension = MIME_EXTENSIONS.get(file.type)
  if (!extension) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, WebP, or GIF image.' }, { status: 400 })
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Snapshot must be between 1 byte and 10 MB.' }, { status: 400 })
  }

  try {
    const filename = `${randomUUID()}.${extension}`
    const directory = path.join(process.cwd(), '.local-uploads', 'vehicle-snapshots', authenticated.user.id)
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()), { flag: 'wx' })
    return NextResponse.json({ url: `/api/uploads/vehicle-snapshot/${filename}` }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/uploads/vehicle-snapshot] Local file write failed:', error)
    return NextResponse.json({ error: 'Unable to store vehicle snapshot locally.' }, { status: 500 })
  }
}
