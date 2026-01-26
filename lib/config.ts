export interface SlackConfig {
  token: string
  channelId: string
}

export interface OpenRouterConfig {
  apiKey: string
}

export interface LangfuseConfig {
  secretKey: string
  publicKey: string
  baseUrl?: string
}

export function loadSlackConfig(): SlackConfig {
  const token = process.env.SLACK_TOKEN
  const channelId = process.env.SLACK_CHANNEL_ID

  if (!token) throw new Error('SLACK_TOKEN is required')
  if (!channelId) throw new Error('SLACK_CHANNEL_ID is required')

  return { token, channelId }
}

export function loadOpenRouterConfig(): OpenRouterConfig {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required')

  return { apiKey }
}

export function loadLangfuseConfig(): LangfuseConfig {
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL

  if (!secretKey) throw new Error('LANGFUSE_SECRET_KEY is required')
  if (!publicKey) throw new Error('LANGFUSE_PUBLIC_KEY is required')

  return { secretKey, publicKey, baseUrl }
}
