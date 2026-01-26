import {
  type SlackMessage,
  type ReleaseMedia,
  insertRelease,
  updateMessageSkipExtraction,
} from './db/client'
import { loadOpenRouterConfig, loadLangfuseConfig, type OpenRouterConfig } from './config'
import { fetchPrompt } from './langfuse'
import { parseJsonArray } from './json'

interface SlackFile {
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

function extractMediaFromMessage(rawJson: Record<string, unknown> | null): ReleaseMedia | null {
  if (!rawJson?.files || !Array.isArray(rawJson.files)) {
    return null
  }

  const files = rawJson.files as SlackFile[]
  const images: ReleaseMedia['images'] = []
  const videos: ReleaseMedia['videos'] = []

  for (const file of files) {
    if (file.mimetype?.startsWith('image/')) {
      images.push({
        id: file.id,
        url: file.permalink_public || file.url_private || '',
        thumb_url: file.thumb_720 || file.thumb_480 || file.thumb_360,
        width: file.original_w,
        height: file.original_h,
        name: file.name,
      })
    } else if (
      file.mimetype?.startsWith('video/') ||
      file.filetype === 'mov' ||
      file.filetype === 'mp4'
    ) {
      videos.push({
        id: file.id,
        url: file.permalink_public || file.mp4 || file.url_private || '',
        mp4_url: file.mp4,
        thumb_url: file.thumb_video,
        duration_ms: file.duration_ms,
        name: file.name,
      })
    }
  }

  if (images.length === 0 && videos.length === 0) {
    return null
  }

  return { images, videos }
}

interface ExtractedRelease {
  date: string
  title: string
  description: string
  sourceMessageId: string
  type: 'New Feature' | 'Improvement' | 'Bug Fix' | 'Deprecation' | 'Rollback' | 'Update'
  whyThisMatters?: string
  impact?: string
}


function formatMessageSimple(msg: SlackMessage): string {
  const date = msg.timestamp.toISOString().split('T')[0]
  return `[${msg.id}] [${date}] ${msg.text}`
}

/**
 * Pass 1: Classify which messages in a group are release announcements
 */
async function classifyMessages(
  messages: SlackMessage[],
  config: OpenRouterConfig,
  classificationPrompt: string
): Promise<Set<string>> {
  if (messages.length === 0) return new Set()

  // For single messages or very few, assume they're all releases
  if (messages.length <= 2) {
    return new Set(messages.map((m) => m.id))
  }

  const messagesText = messages
    .map((msg) => {
      const date = msg.timestamp.toISOString().split('T')[0]
      const preview = msg.text.substring(0, 300) + (msg.text.length > 300 ? '...' : '')
      return `[${msg.id}] [${date}] ${preview}`
    })
    .join('\n\n')

  const fullPrompt = `${classificationPrompt}

Messages to analyze:

${messagesText}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://changenotes.vercel.app',
        'X-Title': 'Changelog Viewer',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        max_tokens: 1024,
        messages: [{ role: 'user', content: fullPrompt }],
      }),
    })

    if (!res.ok) {
      console.error('Classification API error:', res.status)
      // Fallback: return all message IDs
      return new Set(messages.map((m) => m.id))
    }

    const data = await res.json()
    const textContent = data.choices?.[0]?.message?.content

    if (!textContent) {
      return new Set(messages.map((m) => m.id))
    }

    const releaseIds = parseJsonArray<string>(textContent, 'classification')
    return new Set(releaseIds)
  } catch (err) {
    console.error('Classification error:', err)
    return new Set(messages.map((m) => m.id))
  }
}

/**
 * Group messages by thread (thread_ts or self for standalone messages)
 */
function groupMessagesByThread(messages: SlackMessage[]): Map<string, SlackMessage[]> {
  const groups = new Map<string, SlackMessage[]>()

  for (const msg of messages) {
    // Use thread_ts if it's a thread, otherwise use the message's own ID
    const groupKey = msg.thread_ts || msg.id
    const existing = groups.get(groupKey) || []
    existing.push(msg)
    groups.set(groupKey, existing)
  }

  return groups
}

export async function extractReleasesFromMessages(
  messages: SlackMessage[]
): Promise<{ extracted: number; promptVersion: string; errors: string[] }> {
  if (messages.length === 0) {
    return { extracted: 0, promptVersion: 'unknown', errors: [] }
  }

  const openRouterConfig = loadOpenRouterConfig()
  const langfuseConfig = loadLangfuseConfig()

  // Fetch both prompts from Langfuse
  const [extractionResult, classificationResult] = await Promise.all([
    fetchPrompt(langfuseConfig, 'release-extraction'),
    fetchPrompt(langfuseConfig, 'release-classification'),
  ])

  if (!extractionResult) {
    throw new Error('Langfuse prompt "release-extraction" not found')
  }

  if (!classificationResult) {
    throw new Error('Langfuse prompt "release-classification" not found')
  }

  const { prompt, version: promptVersion } = extractionResult
  const { prompt: classificationPrompt } = classificationResult

  let totalExtracted = 0
  const errors: string[] = []

  // Group messages by thread
  const threadGroups = groupMessagesByThread(messages)

  for (const [threadId, threadMessages] of Array.from(threadGroups.entries())) {
    // Pass 1: Classify which messages are release-worthy
    const releaseIds = await classifyMessages(
      threadMessages,
      openRouterConfig,
      classificationPrompt
    )

    console.log(
      `Thread ${threadId}: ${releaseIds.size}/${threadMessages.length} messages identified as releases`
    )

    // Mark non-release messages with skip_extraction
    for (const msg of threadMessages) {
      if (!releaseIds.has(msg.id)) {
        await updateMessageSkipExtraction(msg.id, true)
      }
    }

    // Pass 2: Extract releases from identified messages
    for (const msg of threadMessages) {
      if (!releaseIds.has(msg.id)) {
        continue // Skip non-release messages
      }

      try {
        const formattedMessage = formatMessageSimple(msg)
        const userContent = `${prompt}\n\nMessage to analyze:\n\n${formattedMessage}`

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterConfig.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://changenotes.vercel.app',
            'X-Title': 'Changelog Viewer',
          },
          body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4',
            max_tokens: 4096,
            messages: [{ role: 'user', content: userContent }],
          }),
        })

        if (!res.ok) {
          const errorText = await res.text()
          errors.push(`Message ${msg.id}: API error ${res.status}`)
          console.error(`OpenRouter error for ${msg.id}:`, errorText)
          continue
        }

        const data = await res.json()
        const textContent = data.choices?.[0]?.message?.content

        if (!textContent) {
          continue
        }

        const releases = parseJsonArray<ExtractedRelease>(textContent, 'releases')

        // Use the Slack message timestamp as the release date
        const messageDate = msg.timestamp.toISOString().split('T')[0]

        // Extract media from the message's raw_json
        const media = extractMediaFromMessage(msg.raw_json)

        for (const release of releases) {
          await insertRelease({
            messageId: msg.id,
            date: messageDate,
            title: release.title,
            description: release.description,
            type: release.type,
            whyThisMatters: release.whyThisMatters,
            impact: release.impact,
            promptVersion,
            media,
          })
          totalExtracted++
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Message ${msg.id}: ${errMsg}`)
        console.error(`Failed to process message ${msg.id}:`, err)
      }
    }
  }

  return { extracted: totalExtracted, promptVersion, errors }
}
