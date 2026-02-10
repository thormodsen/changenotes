export function buildSlackUrl(
  messageId: string,
  channelId: string,
  workspace: string
): string {
  const permalink = 'p' + messageId.replace('.', '')
  return `https://${workspace}.slack.com/archives/${channelId}/${permalink}`
}

/**
 * Parse a date string safely, handling YYYY-MM-DD strings without timezone issues.
 */
function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date
  // Append T00:00:00 to date-only strings to avoid UTC interpretation
  return new Date(date.includes('T') ? date : date + 'T00:00:00')
}

/**
 * Format date as ISO string (YYYY-MM-DD).
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString().split('T')[0]
}

/**
 * Format date with customizable options. Safely handles date-only strings.
 */
export function formatDateWithOptions(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = parseDate(date)
  if (isNaN(dateObj.getTime())) return ''

  return dateObj.toLocaleDateString('en-US', options || {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format date for display with weekday, full month, day and year.
 */
export function formatDisplayDate(date: string | Date): string {
  return formatDateWithOptions(date, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format date in short form (e.g., "15 Jan").
 */
export function formatShortDate(date: string | Date): string {
  return formatDateWithOptions(date, {
    day: 'numeric',
    month: 'short',
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
