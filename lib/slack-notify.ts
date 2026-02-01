import { loadSlackConfig } from './config'
import type { ExtractedRelease } from './extraction'

/**
 * Send a notification to Slack about newly extracted releases.
 * Uses SLACK_NOTIFY_CHANNEL if set, otherwise falls back to the main channel.
 */
export async function notifyNewReleases(releases: ExtractedRelease[]): Promise<void> {
  if (releases.length === 0) return

  const config = loadSlackConfig()
  const notifyChannel = process.env.SLACK_NOTIFY_CHANNEL || config.channelId

  const releaseLines = releases
    .slice(0, 10) // Cap at 10 to avoid huge messages
    .map((r) => `• "${r.title}" (${r.type})`)
    .join('\n')

  const suffix = releases.length > 10 ? `\n_...and ${releases.length - 10} more_` : ''

  const text = `📝 *${releases.length} new release${releases.length === 1 ? '' : 's'} extracted*\n${releaseLines}${suffix}`

  try {
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
      console.error('Failed to send Slack notification:', data.error)
    }
  } catch (err) {
    console.error('Error sending Slack notification:', err)
  }
}
