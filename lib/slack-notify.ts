import { loadSlackConfig } from './config'

export interface NotifiableRelease {
  id: string
  title: string
  description: string
}

function getBaseUrl(): string {
  // Use APP_URL if set, otherwise fallback to production URL
  // Note: VERCEL_URL gives preview deployment URLs, not production
  return process.env.APP_URL || 'https://changenotes.vercel.app'
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
    .map((r) => `*<${baseUrl}/changelog/${r.id}|${r.title}>*\n${r.description}`)
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
