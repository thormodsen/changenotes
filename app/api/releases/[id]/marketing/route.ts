import { NextRequest, NextResponse } from 'next/server'
import { getReleaseById, updateReleaseMarketing, getLinkedReleases } from '@/lib/db/client'
import { loadOpenRouterConfig, loadLangfuseConfig } from '@/lib/config'
import { fetchPrompt } from '@/lib/langfuse'
import { parseJsonObject } from '@/lib/json'

interface MarketingContent {
  title: string
  description: string
  whyThisMatters: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const release = await getReleaseById(id)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const openRouterConfig = loadOpenRouterConfig()
    const langfuseConfig = loadLangfuseConfig()

    const langfuseResult = await fetchPrompt(langfuseConfig, 'marketing-copy')
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
        Authorization: `Bearer ${openRouterConfig.apiKey}`,
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

    const marketing = parseJsonObject<MarketingContent>(
      textContent,
      'marketing',
      (obj) => Boolean(obj.title && obj.description && obj.whyThisMatters)
    )

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
