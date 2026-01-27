const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function validateSession(sessionToken: string): boolean {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) return false

    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8')
    const [password, timestampStr] = decoded.split(':')

    if (password !== adminPassword) return false

    const timestamp = parseInt(timestampStr, 10)
    if (isNaN(timestamp)) return false

    const age = Date.now() - timestamp
    if (age > SESSION_MAX_AGE_MS || age < 0) return false

    return true
  } catch {
    return false
  }
}

export function validateApiKey(apiKey: string): boolean {
  const secretKey = process.env.API_SECRET_KEY
  if (!secretKey) return false
  return apiKey === secretKey
}
