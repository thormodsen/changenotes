import { type ReleaseMedia } from './db/client'
import { loadOpenRouterConfig, loadLangfuseConfig, type OpenRouterConfig } from './config'
import { fetchPrompt } from './langfuse'
import { parseJsonArray } from './json'
import { type SlackApiMessage, type SlackFile } from './slack'

function extractMediaFromMessage(msg: SlackApiMessage): ReleaseMedia | null {
  if (!msg.files || msg.files.length === 0) {
    return null
  }

  const images: ReleaseMedia['images'] = []
  const videos: ReleaseMedia['videos'] = []

  for (const file of msg.files) {
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

interface ExtractedReleaseLLM {
  title: string
  description: string
  type?: string // Optional - defaults to "Release" if not provided
  whyThisMatters?: string
  impact?: string
}

// What we return from extraction - ready to be inserted
export interface ExtractedRelease {
  messageId: string
  date: string
  title: string
  description: string
  type: string
  whyThisMatters?: string
  impact?: string
  promptVersion: string
  media: ReleaseMedia | null
  // Slack metadata
  messageTimestamp: Date
  channelId: string
  threadTs: string | null
  editedTs: string | null
  rawJson: Record<string, unknown>
}

function formatMessage(msg: SlackApiMessage): string {
  const timestamp = new Date(parseFloat(msg.ts) * 1000)
  const date = timestamp.toISOString().split('T')[0]
  return `[${msg.ts}] [${date}] ${msg.text || ''}`
}

async function classifyMessages(
  messages: SlackApiMessage[],
  config: OpenRouterConfig,
  classificationPrompt: string
): Promise<Set<string>> {
  if (messages.length === 0) return new Set()

  const messagesText = messages
    .map((msg) => {
      const timestamp = new Date(parseFloat(msg.ts) * 1000)
      const date = timestamp.toISOString().split('T')[0]
      const text = msg.text || ''
      const preview = text.substring(0, 300) + (text.length > 300 ? '...' : '')
      return `[${msg.ts}] [${date}] ${preview}`
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
      return new Set(messages.map((m) => m.ts))
    }

    const data = await res.json()
    const textContent = data.choices?.[0]?.message?.content

    if (!textContent) {
      return new Set(messages.map((m) => m.ts))
    }

    const { data: releaseIds, error } = parseJsonArray<string>(textContent, 'classification')
    if (error) {
      console.warn('Classification parse failed, processing all messages:', error)
      return new Set(messages.map((m) => m.ts))
    }
    return new Set(releaseIds)
  } catch (err) {
    console.error('Classification error:', err)
    return new Set(messages.map((m) => m.ts))
  }
}

function groupMessagesByThread(messages: SlackApiMessage[]): Map<string, SlackApiMessage[]> {
  const groups = new Map<string, SlackApiMessage[]>()

  for (const msg of messages) {
    const groupKey = msg.thread_ts || msg.ts
    const existing = groups.get(groupKey) || []
    existing.push(msg)
    groups.set(groupKey, existing)
  }

  return groups
}

export async function extractReleasesFromMessages(
  messages: SlackApiMessage[],
  channelId: string
): Promise<{ releases: ExtractedRelease[]; promptVersion: string; skippedIds: string[]; errors: string[] }> {
  if (messages.length === 0) {
    return { releases: [], promptVersion: 'unknown', skippedIds: [], errors: [] }
  }

  const openRouterConfig = loadOpenRouterConfig()
  const langfuseConfig = loadLangfuseConfig()

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

  const extractedReleases: ExtractedRelease[] = []
  const skippedIds: string[] = []
  const errors: string[] = []

  const threadGroups = groupMessagesByThread(messages)

  for (const [threadId, threadMessages] of Array.from(threadGroups.entries())) {
    const releaseIds = await classifyMessages(
      threadMessages,
      openRouterConfig,
      classificationPrompt
    )

    const releaseIdList = Array.from(releaseIds).join(', ')
    console.log(
      `Thread ${threadId}: ${releaseIds.size}/${threadMessages.length} messages identified as releases${releaseIdList ? ` (message_ts: ${releaseIdList})` : ''}`
    )

    // Find the parent message for thread context
    const parentMessage = threadMessages.find((m) => m.ts === threadId)

    for (const msg of threadMessages) {
      if (!releaseIds.has(msg.ts)) {
        skippedIds.push(msg.ts)
        continue
      }

      try {
        const formattedMessage = formatMessage(msg)

        // Include parent message context for thread replies
        const isThreadReply = msg.thread_ts && msg.thread_ts !== msg.ts && parentMessage
        let userContent: string
        if (isThreadReply) {
          const parentFormatted = formatMessage(parentMessage)
          userContent = `${prompt}\n\nThread parent message (for context):\n${parentFormatted}\n\nThread reply to analyze:\n\n${formattedMessage}`
          console.log(`  Extracting thread reply ${msg.ts} WITH parent context`)
        } else {
          userContent = `${prompt}\n\nMessage to analyze:\n\n${formattedMessage}`
          console.log(`  Extracting message ${msg.ts} ${msg.thread_ts ? 'WITHOUT parent context (parent not found)' : '(standalone)'}`)
        }

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
          errors.push(`Message ${msg.ts}: API error ${res.status}`)
          console.error(`OpenRouter error for ${msg.ts}:`, errorText)
          continue
        }

        const data = await res.json()
        const textContent = data.choices?.[0]?.message?.content

        if (!textContent) {
          continue
        }

        const { data: llmReleases, error: parseError } = parseJsonArray<ExtractedReleaseLLM>(textContent, 'releases')
        if (parseError) {
          errors.push(`Message ${msg.ts}: ${parseError}`)
          continue
        }
        const messageTimestamp = new Date(parseFloat(msg.ts) * 1000)
        const messageDate = messageTimestamp.toISOString().split('T')[0]
        const media = extractMediaFromMessage(msg)

        // Guard: LLM sometimes returns multiple releases for one message (e.g. alternative phrasings).
        // Keep only the most complete one (longest description) to avoid duplicate release notes.
        const releasesToInsert =
          llmReleases.length > 1
            ? [llmReleases.reduce((a, b) => ((a.description?.length ?? 0) >= (b.description?.length ?? 0) ? a : b))]
            : llmReleases

        if (llmReleases.length > 1) {
          console.warn(`Message ${msg.ts}: LLM returned ${llmReleases.length} releases, keeping most complete`)
        }

        for (const release of releasesToInsert) {
          extractedReleases.push({
            messageId: msg.ts,
            date: messageDate,
            title: release.title,
            description: release.description,
            type: release.type || 'Release',
            whyThisMatters: release.whyThisMatters,
            impact: release.impact,
            promptVersion,
            media,
            messageTimestamp,
            channelId,
            threadTs: msg.thread_ts || null,
            editedTs: msg.edited?.ts || null,
            rawJson: msg as unknown as Record<string, unknown>,
          })
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Message ${msg.ts}: ${errMsg}`)
        console.error(`Failed to process message ${msg.ts}:`, err)
      }
    }
  }

  return { releases: extractedReleases, promptVersion, skippedIds, errors }
}
