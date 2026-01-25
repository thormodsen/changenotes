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
): Promise<SlackApiMessage[]> {
  const res = await fetch(
    `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${threadTs}&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const data = await res.json()
  if (!data.ok) return []

  // Return all messages including parent, we'll filter later
  return data.messages || []
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

        const timestamp = new Date(parseFloat(msg.ts) * 1000)

        // Insert the parent message
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
          inserted++
          existingIds.add(msg.ts)
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

        // If this message has replies, fetch and save them as separate messages
        if (msg.thread_ts === msg.ts && msg.reply_count && msg.reply_count > 0) {
          const threadMessages = await fetchThreadReplies(
            config.slackToken,
            config.slackChannelId,
            msg.ts
          )

          // Skip the first message (it's the parent we already saved)
          for (const reply of threadMessages.slice(1)) {
            if (existingIds.has(reply.ts)) {
              skipped++
              continue
            }

            const replyTimestamp = new Date(parseFloat(reply.ts) * 1000)
            const replySuccess = await insertMessage({
              id: reply.ts,
              channelId: config.slackChannelId,
              text: reply.text || '',
              timestamp: replyTimestamp,
              userId: reply.user,
              username: reply.username,
              threadTs: reply.thread_ts, // Points to parent
              rawJson: reply as unknown as Record<string, unknown>,
            })

            if (replySuccess) {
              inserted++
              existingIds.add(reply.ts)
              newMessages.push({
                id: reply.ts,
                channel_id: config.slackChannelId,
                text: reply.text || '',
                timestamp: replyTimestamp,
                user_id: reply.user || null,
                username: reply.username || null,
                thread_ts: reply.thread_ts || null,
                thread_replies: null,
                raw_json: (reply as unknown as Record<string, unknown>) || null,
                fetched_at: new Date(),
                skip_extraction: false,
              })
            }
          }
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
