export interface ParseResult<T> {
  data: T
  error: string | null
}

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

function extractJsonArray(text: string): string | null {
  const arrayStart = text.indexOf('[')
  if (arrayStart === -1) return null

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

export function parseJsonArray<T>(textContent: string, context: string): ParseResult<T[]> {
  const jsonText = stripMarkdownCodeBlock(textContent)

  const tryParse = (text: string): T[] | null => {
    try {
      const parsed = JSON.parse(text) as T[]
      return Array.isArray(parsed) ? parsed : null
    } catch {
      try {
        const fixed = text.replace(/,(\s*[}\]])/g, '$1')
        const parsed = JSON.parse(fixed) as T[]
        return Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    }
  }

  const result = tryParse(jsonText)
  if (result) {
    return { data: result, error: null }
  }

  const extracted = extractJsonArray(jsonText)
  if (extracted) {
    const extractedResult = tryParse(extracted)
    if (extractedResult) {
      return { data: extractedResult, error: null }
    }
  }

  const preview = jsonText.substring(0, 200)
  const errorMsg = `Failed to parse ${context} JSON: ${preview}${jsonText.length > 200 ? '...' : ''}`
  console.error(errorMsg)

  return { data: [], error: errorMsg }
}

export function parseJsonObject<T>(
  textContent: string,
  context: string,
  validate?: (obj: T) => boolean
): ParseResult<T | null> {
  const jsonText = stripMarkdownCodeBlock(textContent)

  try {
    const parsed = JSON.parse(jsonText) as T
    if (validate && !validate(parsed)) {
      return { data: null, error: `${context} validation failed` }
    }
    return { data: parsed, error: null }
  } catch {
    try {
      const fixed = jsonText.replace(/,(\s*[}\]])/g, '$1')
      const parsed = JSON.parse(fixed) as T
      if (validate && !validate(parsed)) {
        return { data: null, error: `${context} validation failed` }
      }
      return { data: parsed, error: null }
    } catch (err) {
      const preview = jsonText.substring(0, 200)
      const errorMsg = `Failed to parse ${context} JSON: ${preview}${jsonText.length > 200 ? '...' : ''}`
      console.error(errorMsg)
      return { data: null, error: errorMsg }
    }
  }
}
