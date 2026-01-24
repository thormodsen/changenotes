import { NextRequest, NextResponse } from 'next/server'
import { getAllMessages } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await getAllMessages({ limit, offset })

    // Include workspace for Slack permalink generation
    const workspace = process.env.SLACK_WORKSPACE || ''

    return NextResponse.json({
      ...result,
      workspace,
    })
  } catch (err) {
    console.error('Get messages error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
