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

// Extract JSON array from text that may contain preamble/explanation
function extractJsonArray(text: string): string | null {
  // Try to find a JSON array anywhere in the text
  const arrayStart = text.indexOf('[')
  if (arrayStart === -1) return null

  // Find matching closing bracket
  let depth = 0
  for (let i = arrayStart; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) {
        return text.slice(arrayStart, i + 1)
      }
    }
  }
  return null
}

export function parseJsonArray<T>(textContent: string, context: string): T[] {
  const jsonText = stripMarkdownCodeBlock(textContent)

  const tryParse = (text: string): T[] | null => {
    try {
      const parsed = JSON.parse(text) as T[]
      return Array.isArray(parsed) ? parsed : null
    } catch {
      // Try fixing trailing commas
      try {
        const fixed = text.replace(/,(\s*[}\]])/g, '$1')
        const parsed = JSON.parse(fixed) as T[]
        return Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    }
  }

  // Try parsing the whole text first
  const result = tryParse(jsonText)
  if (result) return result

  // Try extracting JSON array from text with preamble
  const extracted = extractJsonArray(jsonText)
  if (extracted) {
    const extractedResult = tryParse(extracted)
    if (extractedResult) return extractedResult
  }

  console.error(`Failed to parse ${context} JSON:`, jsonText.substring(0, 200))
  return []
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
