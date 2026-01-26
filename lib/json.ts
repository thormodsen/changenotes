export function stripMarkdownCodeBlock(text: string): string {
  let result = text.trim()
  if (result.startsWith('```')) {
    const lines = result.split('\n')
    lines.shift()
    if (lines[lines.length - 1]?.trim() === '```') lines.pop()
    result = lines.join('\n').trim()
  }
  return result
}

export function parseJsonArray<T>(textContent: string, context: string): T[] {
  const jsonText = stripMarkdownCodeBlock(textContent)

  try {
    const parsed = JSON.parse(jsonText) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Try fixing trailing commas (common LLM output issue)
    try {
      const fixed = jsonText.replace(/,(\s*[}\]])/g, '$1')
      const parsed = JSON.parse(fixed) as T[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      console.error(`Failed to parse ${context} JSON:`, jsonText.substring(0, 200))
      return []
    }
  }
}

export function parseJsonObject<T>(
  textContent: string,
  context: string,
  validate?: (obj: T) => boolean
): T | null {
  const jsonText = stripMarkdownCodeBlock(textContent)

  try {
    const parsed = JSON.parse(jsonText) as T
    if (validate && !validate(parsed)) return null
    return parsed
  } catch {
    // Try fixing trailing commas (common LLM output issue)
    try {
      const fixed = jsonText.replace(/,(\s*[}\]])/g, '$1')
      const parsed = JSON.parse(fixed) as T
      if (validate && !validate(parsed)) return null
      return parsed
    } catch {
      console.error(`Failed to parse ${context} JSON:`, jsonText.substring(0, 200))
      return null
    }
  }
}
