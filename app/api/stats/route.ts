import { NextResponse } from 'next/server'
import { getStats } from '@/lib/db/client'

export async function GET() {
  try {
    const stats = await getStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('Failed to get stats:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
