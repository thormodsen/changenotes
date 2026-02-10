import { loadSlackConfig } from './config'

export interface NotifiableImage {
  url: string
  name?: string
}

export interface NotifiableRelease {
  id: string
  title: string
  description: string
  images?: NotifiableImage[]
}

function getBaseUrl(): string {
  // Use APP_URL if set, otherwise fallback to production URL
  // Note: VERCEL_URL gives preview deployment URLs, not production
  return process.env.APP_URL || 'https://changenotes.vercel.app'
}

const MAX_IMAGES_PER_RELEASE = 5

/**
 * Post a single image as a thread reply
 */
async function postImageToThread(
  token: string,
  channel: string,
  threadTs: string,
  imageUrl: string
): Promise<void> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      thread_ts: threadTs,
      text: imageUrl,
      unfurl_links: true,
      unfurl_media: true,
    }),
  })

  const data = await res.json()
  if (!data.ok) {
    console.error('[Notify] Failed to post image:', data.error)
  }
}

/**
 * Send a notification to Slack about newly extracted releases.
 * Uses SLACK_NOTIFY_CHANNEL if set, otherwise falls back to the main channel.
 * Posts each release as a separate message with images as thread replies.
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

  // Post each release as a separate message so images can be threaded
  for (const release of releases.slice(0, 10)) {
    const text = `*<${baseUrl}/changelog/${release.id}|${release.title}>*\n${release.description}`

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
        console.error('[Notify] Slack API error:', data.error)
        continue
      }

      console.log(`[Notify] Posted release ${release.id}, ts: ${data.ts}`)

      // Post images as thread replies
      const images = release.images?.slice(0, MAX_IMAGES_PER_RELEASE) || []
      if (images.length > 0) {
        console.log(`[Notify] Posting ${images.length} images to thread`)
        for (const image of images) {
          await postImageToThread(config.token, notifyChannel, data.ts, image.url)
        }
      }
    } catch (err) {
      console.error('[Notify] Error sending notification:', err)
    }
  }

  if (releases.length > 10) {
    console.log(`[Notify] Skipped ${releases.length - 10} releases (over limit)`)
  }
}
