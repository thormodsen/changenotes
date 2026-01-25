import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { insertMessage, type SlackMessage } from '@/lib/db/client'
import { extractReleasesFromMessages } from '@/lib/extraction'

interface SlackApiMessage {
  ts: string
  text?: string
  user?: string
  username?: string
  thread_ts?: string
}

function loadConfig() {
  const slackToken = process.env.SLACK_TOKEN
  const slackChannelId = process.env.SLACK_CHANNEL_ID

  if (!slackToken) throw new Error('SLACK_TOKEN is required')
  if (!slackChannelId) throw new Error('SLACK_CHANNEL_ID is required')

  return { slackToken, slackChannelId }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { threadTs } = body

    if (!threadTs) {
      return NextResponse.json({ error: 'threadTs is required' }, { status: 400 })
    }

    const config = loadConfig()

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
      `https://slack.com/api/conversations.replies?channel=${config.slackChannelId}&ts=${threadTs}&limit=100`,
      { headers: { Authorization: `Bearer ${config.slackToken}` } }
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
        channelId: config.slackChannelId,
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
          channel_id: config.slackChannelId,
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

    return NextResponse.json({
      success: true,
      deleted,
      inserted: newMessages.length,
      extracted,
      promptVersion,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Thread resync error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const maxDuration = 60
