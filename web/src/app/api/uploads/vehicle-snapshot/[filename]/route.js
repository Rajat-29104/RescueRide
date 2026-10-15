import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const FILE_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i
const MIME_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function GET(_request, { params }) {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename } = await params
  if (!FILE_PATTERN.test(filename)) {
    return NextResponse.json({ error: 'Snapshot not found.' }, { status: 404 })
  }

  try {
    const filePath = path.join(
      process.cwd(),
      '.local-uploads',
      'vehicle-snapshots',
      authenticated.user.id,
      filename
    )
    const content = await readFile(filePath)
    const extension = filename.split('.').pop().toLowerCase()
    return new Response(content, {
      headers: {
        'Content-Type': MIME_TYPES[extension],
        'Content-Length': String(content.length),
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error.code === 'ENOENT') return NextResponse.json({ error: 'Snapshot not found.' }, { status: 404 })
    console.error('[GET /api/uploads/vehicle-snapshot] Local file read failed:', error)
    return NextResponse.json({ error: 'Unable to read vehicle snapshot.' }, { status: 500 })
  }
}
