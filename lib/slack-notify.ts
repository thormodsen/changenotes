import { loadSlackConfig } from './config'

export interface NotifiableRelease {
  id: string
  title: string
  description: string
  messageTs: string
  channelId: string
  threadTs?: string | null
}

function getBaseUrl(): string {
  // Use APP_URL if set, otherwise fallback to production URL
  // Note: VERCEL_URL gives preview deployment URLs, not production
  return process.env.APP_URL || 'https://changenotes.vercel.app'
}

function buildSlackMessageUrl(channelId: string, messageTs: string, threadTs?: string | null): string {
  // Slack message URLs use timestamp without the dot
  const tsForUrl = messageTs.replace('.', '')
  const baseUrl = `https://slack.com/archives/${channelId}/p${tsForUrl}`
  
  // If it's a thread reply, add the thread context
  if (threadTs && threadTs !== messageTs) {
    const threadTsForUrl = threadTs.replace('.', '')
    return `${baseUrl}?thread_ts=${threadTsForUrl}&cid=${channelId}`
  }
  
  return baseUrl
}

/**
 * Send a notification to Slack about newly extracted releases.
 * Uses SLACK_NOTIFY_CHANNEL if set, otherwise falls back to the main channel.
 */
export async function notifyNewReleases(releases: NotifiableRelease[]): Promise<void> {
  console.log(`[Notify] Called with ${releases.length} releases`)

  if (releases.length === 0) {
    console.log('[Notify] No releases to notify about, skipping')
    return
  }

  const config = loadSlackConfig()
  const notifyChannel = process.env.SLACK_NOTIFY_CHANNEL || config.channelId
  const baseUrl = getBaseUrl()
  console.log(`[Notify] Sending to channel: ${notifyChannel}, baseUrl: ${baseUrl}`)

  const releaseLines = releases
    .slice(0, 10) // Cap at 10 to avoid huge messages
    .map((r) => {
      const slackUrl = buildSlackMessageUrl(r.channelId, r.messageTs, r.threadTs)
      return `*<${baseUrl}/changelog/${r.id}|${r.title}>*\n${r.description}\n<${slackUrl}|View original message>`
    })
    .join('\n\n')

  const suffix = releases.length > 10 ? `\n\n_...and ${releases.length - 10} more_` : ''

  const text = `${releaseLines}${suffix}`

  try {
    console.log(`[Notify] Posting message: ${text.substring(0, 100)}...`)

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: notifyChannel,
        text,
        unfurl_links: false,
        unfurl_media: false,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('[Notify] Slack API error:', data.error)
    } else {
      console.log(`[Notify] Successfully posted to ${notifyChannel}, ts: ${data.ts}`)
    }
  } catch (err) {
    console.error('[Notify] Error sending notification:', err)
  }
}
