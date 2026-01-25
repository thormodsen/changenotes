import { NextRequest, NextResponse } from 'next/server'
import { getReleaseById, updateReleaseMarketing, getLinkedReleases } from '@/lib/db/client'

interface MarketingContent {
  title: string
  description: string
  whyThisMatters: string
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

  const res = await fetch(`${baseUrl}/api/public/v2/prompts/marketing-copy`, {
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

function parseMarketingFromResponse(textContent: string): MarketingContent | null {
  let jsonText = textContent.trim()

  if (jsonText.startsWith('```')) {
    const lines = jsonText.split('\n')
    lines.shift()
    if (lines[lines.length - 1]?.trim() === '```') lines.pop()
    jsonText = lines.join('\n').trim()
  }

  try {
    const parsed = JSON.parse(jsonText) as MarketingContent
    if (parsed.title && parsed.description && parsed.whyThisMatters) {
      return parsed
    }
    return null
  } catch {
    try {
      const fixed = jsonText.replace(/,(\s*[}\]])/g, '$1')
      const parsed = JSON.parse(fixed) as MarketingContent
      if (parsed.title && parsed.description && parsed.whyThisMatters) {
        return parsed
      }
      return null
    } catch {
      console.error('Failed to parse marketing JSON:', jsonText.substring(0, 200))
      return null
    }
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const release = await getReleaseById(id)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const config = loadConfig()

    if (!config.langfuseSecretKey || !config.langfusePublicKey) {
      throw new Error('Langfuse configuration is required')
    }

    const langfuseResult = await fetchLangfusePrompt({
      secretKey: config.langfuseSecretKey,
      publicKey: config.langfusePublicKey,
      baseUrl: config.langfuseBaseUrl,
    })

    if (!langfuseResult) {
      throw new Error('Langfuse prompt "marketing-copy" not found')
    }

    const { prompt } = langfuseResult

    // Fetch thread context if this release is part of a thread
    const linked = await getLinkedReleases(id)

    let threadContext = ''
    if (linked.parent || linked.siblings.length > 0) {
      const contextParts: string[] = []

      if (linked.parent) {
        contextParts.push(`PARENT RELEASE (main feature):
Title: ${linked.parent.title}
Type: ${linked.parent.type}
Description: ${linked.parent.description || 'N/A'}`)
      }

      if (linked.siblings.length > 0) {
        const siblingsText = linked.siblings
          .map(s => `- ${s.title} (${s.type}): ${s.description || 'N/A'}`)
          .join('\n')
        contextParts.push(`OTHER UPDATES IN THIS THREAD:\n${siblingsText}`)
      }

      threadContext = `
## Thread Context
This release is part of a feature rollout. Here's the context:

${contextParts.join('\n\n')}

---

`
    }

    const releaseContent = `
Title: ${release.title}
Type: ${release.type}
Description: ${release.description || 'N/A'}
Why This Matters: ${release.why_this_matters || 'N/A'}
`.trim()

    const userContent = `${prompt}\n\n${threadContext}Release note to transform:\n\n${releaseContent}`

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('OpenRouter error:', errorText)
      return NextResponse.json({ error: `API error: ${res.status}` }, { status: 500 })
    }

    const data = await res.json()
    const textContent = data.choices?.[0]?.message?.content

    if (!textContent) {
      return NextResponse.json({ error: 'No content in response' }, { status: 500 })
    }

    const marketing = parseMarketingFromResponse(textContent)

    if (!marketing) {
      return NextResponse.json({ error: 'Failed to parse marketing content' }, { status: 500 })
    }

    const updated = await updateReleaseMarketing(id, marketing)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to save marketing content' }, { status: 500 })
    }

    return NextResponse.json({ success: true, marketing })
  } catch (err) {
    console.error('Failed to generate marketing:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
