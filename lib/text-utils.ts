import { EMOJI_MAP } from './constants'

export function convertEmojis(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/g, (match, code) => {
    return EMOJI_MAP[code] || match
  })
}

export function buildSlackUrl(
  messageId: string,
  channelId: string,
  workspace: string
): string {
  const permalink = 'p' + messageId.replace('.', '')
  return `https://${workspace}.slack.com/archives/${channelId}/${permalink}`
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString().split('T')[0]
}

export function formatDisplayDate(date: string): string {
  const dateStr = date.includes('T') ? date : date + 'T00:00:00'
  const dateObj = new Date(dateStr)

  if (isNaN(dateObj.getTime())) {
    return date
  }

  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
