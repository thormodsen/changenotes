import { type SlackMessage, insertRelease, updateMessageSkipExtraction } from './db/client'

interface ExtractedRelease {
  date: string
  title: string
  description: string
  sourceMessageId: string
  type: 'New Feature' | 'Improvement' | 'Bug Fix' | 'Deprecation' | 'Rollback' | 'Update'
  whyThisMatters?: string
  impact?: string
}

function loadConfig() {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY
  const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY
  const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY
  const langfuseBaseUrl = process.env.LANGFUSE_BASE_URL

  if (!openRouterApiKey) throw new Error('OPENROUTER_API_KEY is required')

  return { openRouterApiKey, langfuseSecretKey, langfusePublicKey, langfuseBaseUrl }
}

async function fetchLangfusePrompt(
  config: { secretKey: string; publicKey: string; baseUrl?: string },
  promptName: string
): Promise<{ prompt: string; version: string } | null> {
  const baseUrl = config.baseUrl || 'https://cloud.langfuse.com'
  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64')

  const res = await fetch(`${baseUrl}/api/public/v2/prompts/${promptName}`, {
    headers: { Authorization: `Basic ${auth}` },
  })

  if (!res.ok) return null

  const data = await res.json()
  let promptText: string | null = null

  if (data.prompt) {
    if (Array.isArray(data.prompt)) {
      promptText = data.prompt.map((m: { content: string }) => m.content).join('\n')
    } else {
      promptText = data.prompt
    }
  }

  if (!promptText) return null

  return {
    prompt: promptText,
    version: data.version?.toString() || 'unknown',
  }
}

function formatMessageSimple(msg: SlackMessage): string {
  const date = msg.timestamp.toISOString().split('T')[0]
  return `[${msg.id}] [${date}] ${msg.text}`
}

function parseReleasesFromResponse(textContent: string): ExtractedRelease[] {
  let jsonText = textContent.trim()

  if (jsonText.startsWith('```')) {
    const lines = jsonText.split('\n')
    lines.shift()
    if (lines[lines.length - 1]?.trim() === '```') lines.pop()
    jsonText = lines.join('\n').trim()
  }

  try {
    const releases = JSON.parse(jsonText) as ExtractedRelease[]
    return Array.isArray(releases) ? releases : []
  } catch {
    try {
      const fixed = jsonText.replace(/,(\s*[}\]])/g, '$1')
      const releases = JSON.parse(fixed) as ExtractedRelease[]
      return Array.isArray(releases) ? releases : []
    } catch {
      console.error('Failed to parse releases JSON:', jsonText.substring(0, 200))
      return []
    }
  }
}

function parseClassificationResponse(textContent: string): string[] {
  let jsonText = textContent.trim()

  if (jsonText.startsWith('```')) {
    const lines = jsonText.split('\n')
    lines.shift()
    if (lines[lines.length - 1]?.trim() === '```') lines.pop()
    jsonText = lines.join('\n').trim()
  }

  try {
    const ids = JSON.parse(jsonText) as string[]
    return Array.isArray(ids) ? ids : []
  } catch {
    console.error('Failed to parse classification JSON:', jsonText.substring(0, 200))
    return []
  }
}

/**
 * Pass 1: Classify which messages in a group are release announcements
 */
async function classifyMessages(
  messages: SlackMessage[],
  config: { openRouterApiKey: string },
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
        Authorization: `Bearer ${config.openRouterApiKey}`,
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

    const releaseIds = parseClassificationResponse(textContent)
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

  const config = loadConfig()

  // Get prompt from Langfuse
  if (!config.langfuseSecretKey || !config.langfusePublicKey) {
    throw new Error('Langfuse configuration is required')
  }

  const langfuseConfig = {
    secretKey: config.langfuseSecretKey,
    publicKey: config.langfusePublicKey,
    baseUrl: config.langfuseBaseUrl,
  }

  // Fetch both prompts from Langfuse
  const [extractionResult, classificationResult] = await Promise.all([
    fetchLangfusePrompt(langfuseConfig, 'release-extraction'),
    fetchLangfusePrompt(langfuseConfig, 'release-classification'),
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
      { openRouterApiKey: config.openRouterApiKey },
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
            Authorization: `Bearer ${config.openRouterApiKey}`,
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

        const releases = parseReleasesFromResponse(textContent)

        // Use the Slack message timestamp as the release date
        const messageDate = msg.timestamp.toISOString().split('T')[0]

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
