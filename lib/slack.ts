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

/**
 * Fetch recent replies to known threads.
 * conversations.history doesn't return thread replies unless broadcast.
 * This fetches replies for given threads within the time range.
 */
export async function fetchRecentThreadReplies(
  threadTsList: string[],
  options: { oldest?: number; latest?: number }
): Promise<SlackApiMessage[]> {
  if (threadTsList.length === 0) return []

  const config = loadSlackConfig()
  const oldestTs = options.oldest ? options.oldest / 1000 : 0
  const latestTs = options.latest ? options.latest / 1000 : Date.now() / 1000
  const replies: SlackApiMessage[] = []

  console.log(`[Slack] Fetching recent replies for ${threadTsList.length} known threads`)

  // Fetch all threads in parallel for better performance
  const allThreadMessages = await Promise.all(
    threadTsList.map(threadTs => fetchThreadReplies(threadTs).then(msgs => ({ threadTs, msgs })))
  )

  for (const { threadTs, msgs } of allThreadMessages) {
    for (const msg of msgs) {
      // Skip parent message (we only want replies)
      if (msg.ts === threadTs) continue
      // Skip excluded bots
      if (msg.bot_id && config.excludeBotIds.includes(msg.bot_id)) continue
      // Only include if within time range
      const msgTs = parseFloat(msg.ts)
      if (msgTs >= oldestTs && msgTs <= latestTs) {
        replies.push(msg)
      }
    }
  }

  console.log(`[Slack] Found ${replies.length} recent thread replies`)
  return replies
}

/**
 * Fetch missing parent messages for thread replies.
 * When syncing a limited time range, thread replies may be fetched without their parent.
 * This function identifies those orphan replies and fetches their parent messages.
 */
export async function fetchMissingParents(messages: SlackApiMessage[]): Promise<SlackApiMessage[]> {
  const messageIds = new Set(messages.map(m => m.ts))
  const missingParentTs = new Set<string>()

  for (const msg of messages) {
    if (msg.thread_ts && msg.thread_ts !== msg.ts && !messageIds.has(msg.thread_ts)) {
      missingParentTs.add(msg.thread_ts)
    }
  }

  if (missingParentTs.size === 0) {
    return messages
  }

  console.log(`[Slack] Fetching ${missingParentTs.size} missing parent messages for thread context`)

  const config = loadSlackConfig()

  // Fetch all missing parents in parallel for better performance
  const allThreadMessages = await Promise.all(
    Array.from(missingParentTs).map(parentTs =>
      fetchThreadReplies(parentTs).then(msgs => ({ parentTs, msgs }))
    )
  )

  const additionalMessages: SlackApiMessage[] = []
  for (const { parentTs, msgs } of allThreadMessages) {
    const parent = msgs.find(m => m.ts === parentTs)
    if (parent && (!parent.bot_id || !config.excludeBotIds.includes(parent.bot_id))) {
      additionalMessages.push(parent)
    }
  }

  // Combine and deduplicate
  const combined = [...messages, ...additionalMessages]
  const seen = new Set<string>()
  return combined.filter(msg => {
    if (seen.has(msg.ts)) return false
    seen.add(msg.ts)
    return true
  })
}
