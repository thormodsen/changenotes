import { type LangfuseConfig } from './config'

export interface LangfusePrompt {
  prompt: string
  version: string
}

export async function fetchPrompt(
  config: LangfuseConfig,
  promptName: string
): Promise<LangfusePrompt | null> {
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
