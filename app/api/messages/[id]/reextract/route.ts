import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { extractReleasesFromMessages } from '@/lib/extraction'
import type { SlackMessage } from '@/lib/db/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete existing releases for this message
    await sql`DELETE FROM releases WHERE message_id = ${id}`

    // Fetch the message
    const result = await sql<SlackMessage>`
      SELECT * FROM slack_messages WHERE id = ${id}
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const message = result.rows[0]

    // Re-extract releases
    const { extracted, promptVersion } = await extractReleasesFromMessages([message])

    return NextResponse.json({
      success: true,
      extracted,
      promptVersion,
    })
  } catch (err) {
    console.error('Reextract error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
