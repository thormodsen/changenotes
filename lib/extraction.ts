import { type SlackMessage, type ThreadReply, insertRelease } from './db/client'

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

async function fetchLangfusePrompt(config: {
  secretKey: string
  publicKey: string
  baseUrl?: string
}): Promise<{ prompt: string; version: string } | null> {
  const baseUrl = config.baseUrl || 'https://cloud.langfuse.com'
  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64')

  const res = await fetch(`${baseUrl}/api/public/v2/prompts/release-extraction`, {
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

function formatMessage(msg: SlackMessage): string {
  const date = msg.timestamp.toISOString().split('T')[0]
  let text = `[${msg.id}] [${date}] ${msg.text}`

  const replies = msg.thread_replies as ThreadReply[] | null
  if (replies?.length) {
    const threadText = replies
      .map((reply) => {
        const replyDate = new Date(parseFloat(reply.timestamp) * 1000).toISOString().split('T')[0]
        const author = reply.username || `user-${reply.user_id.substring(0, 8)}`
        return `  └─ [${reply.id}] [${replyDate}] @${author}: ${reply.text}`
      })
      .join('\n')
    text += `\n  [Thread replies (${replies.length}):]\n${threadText}`
  }

  return text
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

  const langfuseResult = await fetchLangfusePrompt({
    secretKey: config.langfuseSecretKey,
    publicKey: config.langfusePublicKey,
    baseUrl: config.langfuseBaseUrl,
  })

  if (!langfuseResult) {
    throw new Error('Langfuse prompt "release-extraction" not found')
  }

  const { prompt, version: promptVersion } = langfuseResult

  let totalExtracted = 0
  const errors: string[] = []

  for (const msg of messages) {
    try {
      const formattedMessage = formatMessage(msg)
      const userContent = `${prompt}\n\nMessage to analyze:\n\n${formattedMessage}`

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://changelog-viewer.vercel.app',
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

  return { extracted: totalExtracted, promptVersion, errors }
}
