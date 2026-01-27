import { loadSlackConfig } from './config'

// Slack API message type
export interface SlackApiMessage {
  ts: string
  text?: string
  user?: string
  username?: string
  bot_id?: string
  subtype?: string
  thread_ts?: string
  reply_count?: number
  edited?: {
    user: string
    ts: string
  }
  files?: SlackFile[]
}

export interface SlackFile {
  id: string
  mimetype?: string
  filetype?: string
  permalink_public?: string
  url_private?: string
  mp4?: string
  thumb_video?: string
  thumb_720?: string
  thumb_480?: string
  thumb_360?: string
  original_w?: number
  original_h?: number
  duration_ms?: number
  name?: string
}

export async function fetchSlackMessages(options: {
  oldest?: number
  latest?: number
}): Promise<SlackApiMessage[]> {
  const config = loadSlackConfig()
  const messages: SlackApiMessage[] = []
  let cursor: string | undefined

  const oldestTs = options.oldest ? (options.oldest / 1000).toString() : undefined
  const latestTs = options.latest ? (options.latest / 1000).toString() : undefined

  do {
    const params = new URLSearchParams({
      channel: config.channelId,
      limit: '200',
    })
    if (oldestTs) params.append('oldest', oldestTs)
    if (latestTs) params.append('latest', latestTs)
    if (cursor) params.append('cursor', cursor)

    const res = await fetch(`https://slack.com/api/conversations.history?${params}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    })

    const data = await res.json()
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`)

    for (const msg of (data.messages || []) as SlackApiMessage[]) {
      // Skip messages from excluded bots
      if (msg.bot_id && config.excludeBotIds.includes(msg.bot_id)) {
        continue
      }

      messages.push(msg)

      // If this message has replies, fetch them too
      if (msg.thread_ts === msg.ts && msg.reply_count && msg.reply_count > 0) {
        const threadMessages = await fetchThreadReplies(msg.ts)
        // Add replies (skip the parent which we already have, and excluded bots)
        for (const reply of threadMessages.slice(1)) {
          if (reply.bot_id && config.excludeBotIds.includes(reply.bot_id)) {
            continue
          }
          messages.push(reply)
        }
      }
    }

    cursor = data.response_metadata?.next_cursor
  } while (cursor)

  // Deduplicate by ts (replies broadcast to channel appear in both history and thread)
  const seen = new Set<string>()
  return messages.filter(msg => {
    if (seen.has(msg.ts)) return false
    seen.add(msg.ts)
    return true
  })
}

export async function fetchThreadReplies(threadTs: string): Promise<SlackApiMessage[]> {
  const config = loadSlackConfig()

  const res = await fetch(
    `https://slack.com/api/conversations.replies?channel=${config.channelId}&ts=${threadTs}&limit=100`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  )

  const data = await res.json()
  if (!data.ok) return []

  return data.messages || []
}
