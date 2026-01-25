import { NextRequest, NextResponse } from 'next/server'
import { insertMessage, getMessageIds, initializeSchema, type SlackMessage } from '@/lib/db/client'
import { extractReleasesFromMessages } from '@/lib/extraction'

interface SlackApiMessage {
  ts: string
  text?: string
  user?: string
  username?: string
  app_id?: string
  bot_id?: string
  thread_ts?: string
  reply_count?: number
}

function loadConfig() {
  const slackToken = process.env.SLACK_TOKEN
  const slackChannelId = process.env.SLACK_CHANNEL_ID

  if (!slackToken) throw new Error('SLACK_TOKEN is required')
  if (!slackChannelId) throw new Error('SLACK_CHANNEL_ID is required')

  return { slackToken, slackChannelId }
}

async function fetchThreadReplies(
  token: string,
  channelId: string,
  threadTs: string
): Promise<Array<{ id: string; text: string; timestamp: string; user_id: string; username?: string }>> {
  const res = await fetch(
    `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${threadTs}&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const data = await res.json()
  if (!data.ok) return []

  return (data.messages || [])
    .slice(1)
    .map((msg: SlackApiMessage) => ({
      id: msg.ts,
      text: msg.text || '',
      timestamp: msg.ts,
      user_id: msg.user || '',
      username: msg.username,
    }))
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const days = searchParams.get('days')

    const config = loadConfig()

    // Ensure schema exists
    await initializeSchema()

    // Get existing message IDs to skip
    const existingIds = await getMessageIds(config.slackChannelId)

    // Calculate time window
    let oldest: number | undefined
    let latest: number | undefined

    if (startDate) {
      oldest = new Date(startDate).getTime()
      if (endDate) {
        latest = new Date(endDate).getTime() + 24 * 60 * 60 * 1000
      }
    } else if (days) {
      const daysNum = parseInt(days, 10)
      oldest = Date.now() - daysNum * 24 * 60 * 60 * 1000
    }

    // Fetch messages from Slack
    let inserted = 0
    let skipped = 0
    let cursor: string | undefined
    const newMessages: SlackMessage[] = []

    const oldestTs = oldest ? (oldest / 1000).toString() : undefined
    const latestTs = latest ? (latest / 1000).toString() : undefined

    do {
      const params = new URLSearchParams({
        channel: config.slackChannelId,
        limit: '200',
      })
      if (oldestTs) params.append('oldest', oldestTs)
      if (latestTs) params.append('latest', latestTs)
      if (cursor) params.append('cursor', cursor)

      const res = await fetch(`https://slack.com/api/conversations.history?${params}`, {
        headers: { Authorization: `Bearer ${config.slackToken}` },
      })

      const data = await res.json()
      if (!data.ok) throw new Error(`Slack API error: ${data.error}`)

      for (const msg of (data.messages || []) as SlackApiMessage[]) {
        if (existingIds.has(msg.ts)) {
          skipped++
          continue
        }

        // Fetch thread replies if present
        let threadReplies: Array<{ id: string; text: string; timestamp: string; user_id: string; username?: string }> | undefined
        if (msg.thread_ts && msg.reply_count && msg.reply_count > 0) {
          threadReplies = await fetchThreadReplies(config.slackToken, config.slackChannelId, msg.thread_ts)
        }

        const timestamp = new Date(parseFloat(msg.ts) * 1000)
        const success = await insertMessage({
          id: msg.ts,
          channelId: config.slackChannelId,
          text: msg.text || '',
          timestamp,
          userId: msg.user,
          username: msg.username,
          threadReplies,
          rawJson: msg as unknown as Record<string, unknown>,
        })

        if (success) {
          inserted++
          existingIds.add(msg.ts)
          // Track new messages for extraction
          newMessages.push({
            id: msg.ts,
            channel_id: config.slackChannelId,
            text: msg.text || '',
            timestamp,
            user_id: msg.user || null,
            username: msg.username || null,
            thread_ts: msg.thread_ts || null,
            thread_replies: threadReplies || null,
            raw_json: (msg as unknown as Record<string, unknown>) || null,
            fetched_at: new Date(),
            skip_extraction: false,
          })
        }
      }

      cursor = data.response_metadata?.next_cursor
    } while (cursor)

    // Extract releases from newly synced messages
    let extracted = 0
    let promptVersion = 'unknown'
    if (newMessages.length > 0) {
      const result = await extractReleasesFromMessages(newMessages)
      extracted = result.extracted
      promptVersion = result.promptVersion
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total: inserted + skipped,
      extracted,
      promptVersion,
    })
  } catch (err) {
    console.error('Sync error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const maxDuration = 60
