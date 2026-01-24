import { NextResponse } from 'next/server'
import { initializeSchema } from '@/lib/db/client'

export async function POST() {
  try {
    await initializeSchema()
    return NextResponse.json({ success: true, message: 'Schema initialized' })
  } catch (err) {
    console.error('Failed to initialize schema:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
