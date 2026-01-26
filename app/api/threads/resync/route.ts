import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { insertMessage, type SlackMessage, type Release } from '@/lib/db/client'
import { extractReleasesFromMessages } from '@/lib/extraction'
import { loadSlackConfig } from '@/lib/config'

interface SlackApiMessage {
  ts: string
  text?: string
  user?: string
  username?: string
  thread_ts?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { threadTs } = body

    if (!threadTs) {
      return NextResponse.json({ error: 'threadTs is required' }, { status: 400 })
    }

    const slackConfig = loadSlackConfig()

    // Step 1: Delete existing messages and releases for this thread
    // Delete releases first (foreign key constraint)
    await sql`
      DELETE FROM releases
      WHERE message_id IN (
        SELECT id FROM slack_messages
        WHERE thread_ts = ${threadTs} OR id = ${threadTs}
      )
    `

    // Delete messages
    const deleteResult = await sql`
      DELETE FROM slack_messages
      WHERE thread_ts = ${threadTs} OR id = ${threadTs}
    `
    const deleted = deleteResult.rowCount ?? 0

    // Step 2: Fetch thread from Slack
    const res = await fetch(
      `https://slack.com/api/conversations.replies?channel=${slackConfig.channelId}&ts=${threadTs}&limit=100`,
      { headers: { Authorization: `Bearer ${slackConfig.token}` } }
    )

    const data = await res.json()
    if (!data.ok) {
      return NextResponse.json({ error: `Slack API error: ${data.error}` }, { status: 500 })
    }

    const threadMessages = (data.messages || []) as SlackApiMessage[]
    const newMessages: SlackMessage[] = []

    // Step 3: Insert all messages
    for (const msg of threadMessages) {
      const timestamp = new Date(parseFloat(msg.ts) * 1000)

      const success = await insertMessage({
        id: msg.ts,
        channelId: slackConfig.channelId,
        text: msg.text || '',
        timestamp,
        userId: msg.user,
        username: msg.username,
        threadTs: msg.thread_ts,
        rawJson: msg as unknown as Record<string, unknown>,
      })

      if (success) {
        newMessages.push({
          id: msg.ts,
          channel_id: slackConfig.channelId,
          text: msg.text || '',
          timestamp,
          user_id: msg.user || null,
          username: msg.username || null,
          thread_ts: msg.thread_ts || null,
          thread_replies: null,
          raw_json: (msg as unknown as Record<string, unknown>) || null,
          fetched_at: new Date(),
          skip_extraction: false,
        })
      }
    }

    // Step 4: Run extraction
    let extracted = 0
    let promptVersion = 'unknown'
    const errors: string[] = []

    if (newMessages.length > 0) {
      const result = await extractReleasesFromMessages(newMessages)
      extracted = result.extracted
      promptVersion = result.promptVersion
      errors.push(...result.errors)
    }

    // Step 5: Fetch the extracted releases to return details
    const releasesResult = await sql<Release>`
      SELECT id, title, date, type, description
      FROM releases
      WHERE message_id IN (
        SELECT id FROM slack_messages
        WHERE thread_ts = ${threadTs} OR id = ${threadTs}
      )
      ORDER BY date DESC
    `

    const releases = releasesResult.rows.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      type: r.type,
      description: r.description,
    }))

    return NextResponse.json({
      success: true,
      deleted,
      inserted: newMessages.length,
      extracted,
      promptVersion,
      releases,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Thread resync error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const maxDuration = 60
