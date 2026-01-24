import { sql } from '@vercel/postgres'

// Types
export interface SlackMessage {
  id: string
  channel_id: string
  text: string
  timestamp: Date
  user_id: string | null
  username: string | null
  thread_replies: ThreadReply[] | null
  raw_json: Record<string, unknown> | null
  fetched_at: Date
  skip_extraction: boolean
}

export interface ThreadReply {
  id: string
  text: string
  timestamp: string
  user_id: string
  username?: string
}

export interface Release {
  id: string
  message_id: string
  date: string
  title: string
  description: string | null
  type: string
  why_this_matters: string | null
  impact: string | null
  prompt_version: string | null
  extracted_at: Date
  published: boolean
  published_at: Date | null
}

// Initialize schema
export async function initializeSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS slack_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      user_id TEXT,
      username TEXT,
      thread_replies JSONB,
      raw_json JSONB,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      skip_extraction BOOLEAN DEFAULT FALSE
    )
  `

  // Add skip_extraction column if it doesn't exist (for existing tables)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'slack_messages' AND column_name = 'skip_extraction'
      ) THEN
        ALTER TABLE slack_messages ADD COLUMN skip_extraction BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
  `

  await sql`
    CREATE TABLE IF NOT EXISTS releases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id TEXT NOT NULL REFERENCES slack_messages(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      why_this_matters TEXT,
      impact TEXT,
      prompt_version TEXT,
      extracted_at TIMESTAMPTZ DEFAULT NOW(),
      published BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMPTZ
    )
  `

  // Create indexes (these are idempotent)
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON slack_messages(timestamp DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_message ON releases(message_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_date ON releases(date DESC)`
}

// Messages
export async function insertMessage(msg: {
  id: string
  channelId: string
  text: string
  timestamp: Date
  userId?: string
  username?: string
  threadReplies?: ThreadReply[]
  rawJson?: Record<string, unknown>
}): Promise<boolean> {
  try {
    await sql`
      INSERT INTO slack_messages (id, channel_id, text, timestamp, user_id, username, thread_replies, raw_json)
      VALUES (
        ${msg.id},
        ${msg.channelId},
        ${msg.text},
        ${msg.timestamp.toISOString()},
        ${msg.userId ?? null},
        ${msg.username ?? null},
        ${msg.threadReplies ? JSON.stringify(msg.threadReplies) : null},
        ${msg.rawJson ? JSON.stringify(msg.rawJson) : null}
      )
      ON CONFLICT (id) DO NOTHING
    `
    return true
  } catch (err) {
    console.error('Failed to insert message:', err)
    return false
  }
}

export async function getMessageIds(channelId: string): Promise<Set<string>> {
  const result = await sql<{ id: string }>`
    SELECT id FROM slack_messages WHERE channel_id = ${channelId}
  `
  return new Set(result.rows.map((r) => r.id))
}

export async function getAllMessages(options?: {
  limit?: number
  offset?: number
}): Promise<{ messages: SlackMessage[]; total: number }> {
  const limit = options?.limit || 100
  const offset = options?.offset || 0

  const [messagesResult, countResult] = await Promise.all([
    sql<SlackMessage>`
      SELECT * FROM slack_messages
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql<{ count: string }>`SELECT COUNT(*) as count FROM slack_messages`,
  ])

  return {
    messages: messagesResult.rows,
    total: parseInt(countResult.rows[0].count),
  }
}

export async function updateMessageSkipExtraction(
  id: string,
  skipExtraction: boolean
): Promise<boolean> {
  try {
    await sql`
      UPDATE slack_messages
      SET skip_extraction = ${skipExtraction}
      WHERE id = ${id}
    `
    return true
  } catch (err) {
    console.error('Failed to update skip_extraction:', err)
    return false
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  try {
    await sql`DELETE FROM slack_messages WHERE id = ${id}`
    return true
  } catch (err) {
    console.error('Failed to delete message:', err)
    return false
  }
}

export async function getReleasesByMessageId(messageId: string): Promise<Release[]> {
  const result = await sql<Release>`
    SELECT * FROM releases WHERE message_id = ${messageId}
  `
  return result.rows
}

export async function getMessagesWithoutReleases(promptVersion?: string): Promise<SlackMessage[]> {
  if (promptVersion) {
    // Get messages that either have no releases OR have releases with a different prompt version
    // Skip messages marked with skip_extraction = true
    const result = await sql<SlackMessage>`
      SELECT m.* FROM slack_messages m
      WHERE m.skip_extraction = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM releases r
        WHERE r.message_id = m.id
        AND r.prompt_version = ${promptVersion}
      )
      ORDER BY m.timestamp DESC
    `
    return result.rows
  }

  // Get messages with no releases at all and skip_extraction = false
  const result = await sql<SlackMessage>`
    SELECT m.* FROM slack_messages m
    WHERE m.skip_extraction = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM releases r WHERE r.message_id = m.id
    )
    ORDER BY m.timestamp DESC
  `
  return result.rows
}

export async function getMessagesByDateRange(
  start: Date,
  end: Date
): Promise<SlackMessage[]> {
  const result = await sql<SlackMessage>`
    SELECT * FROM slack_messages
    WHERE timestamp >= ${start.toISOString()}
    AND timestamp <= ${end.toISOString()}
    ORDER BY timestamp DESC
  `
  return result.rows
}

// Releases
export async function insertRelease(release: {
  messageId: string
  date: string
  title: string
  description?: string
  type: string
  whyThisMatters?: string
  impact?: string
  promptVersion?: string
}): Promise<string | null> {
  try {
    const result = await sql<{ id: string }>`
      INSERT INTO releases (message_id, date, title, description, type, why_this_matters, impact, prompt_version)
      VALUES (
        ${release.messageId},
        ${release.date},
        ${release.title},
        ${release.description ?? null},
        ${release.type},
        ${release.whyThisMatters ?? null},
        ${release.impact ?? null},
        ${release.promptVersion ?? null}
      )
      RETURNING id
    `
    return result.rows[0]?.id ?? null
  } catch (err) {
    console.error('Failed to insert release:', err)
    return null
  }
}

export async function getReleases(options?: {
  startDate?: string
  endDate?: string
  published?: boolean
  promptVersion?: string
  limit?: number
}): Promise<Release[]> {
  let query = 'SELECT * FROM releases WHERE 1=1'
  const params: unknown[] = []
  let paramIndex = 1

  if (options?.startDate) {
    query += ` AND date >= $${paramIndex++}`
    params.push(options.startDate)
  }
  if (options?.endDate) {
    query += ` AND date <= $${paramIndex++}`
    params.push(options.endDate)
  }
  if (options?.published !== undefined) {
    query += ` AND published = $${paramIndex++}`
    params.push(options.published)
  }
  if (options?.promptVersion) {
    query += ` AND prompt_version = $${paramIndex++}`
    params.push(options.promptVersion)
  }

  query += ' ORDER BY date DESC, extracted_at DESC'

  if (options?.limit) {
    query += ` LIMIT $${paramIndex++}`
    params.push(options.limit)
  }

  const result = await sql.query<Release>(query, params)
  return result.rows
}

export async function deleteReleasesForReextraction(promptVersion?: string): Promise<number> {
  if (promptVersion) {
    const result = await sql`
      DELETE FROM releases WHERE prompt_version != ${promptVersion} OR prompt_version IS NULL
    `
    return result.rowCount ?? 0
  }

  const result = await sql`DELETE FROM releases`
  return result.rowCount ?? 0
}

export async function publishReleases(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const result = await sql.query(
    `UPDATE releases SET published = true, published_at = NOW() WHERE id = ANY($1::uuid[])`,
    [ids]
  )
  return result.rowCount ?? 0
}

export async function unpublishReleases(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const result = await sql.query(
    `UPDATE releases SET published = false, published_at = NULL WHERE id = ANY($1::uuid[])`,
    [ids]
  )
  return result.rowCount ?? 0
}

export async function updateRelease(
  id: string,
  updates: {
    title?: string
    description?: string
    type?: string
    whyThisMatters?: string
    impact?: string
  }
): Promise<boolean> {
  try {
    const fields: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`)
      params.push(updates.title)
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`)
      params.push(updates.description)
    }
    if (updates.type !== undefined) {
      fields.push(`type = $${paramIndex++}`)
      params.push(updates.type)
    }
    if (updates.whyThisMatters !== undefined) {
      fields.push(`why_this_matters = $${paramIndex++}`)
      params.push(updates.whyThisMatters)
    }
    if (updates.impact !== undefined) {
      fields.push(`impact = $${paramIndex++}`)
      params.push(updates.impact)
    }

    if (fields.length === 0) return false

    params.push(id)
    const query = `UPDATE releases SET ${fields.join(', ')} WHERE id = $${paramIndex}`

    await sql.query(query, params)
    return true
  } catch (err) {
    console.error('Failed to update release:', err)
    return false
  }
}

export async function getStats(): Promise<{
  totalMessages: number
  totalReleases: number
  publishedReleases: number
  messagesWithoutReleases: number
}> {
  const [messages, releases, published, unprocessed] = await Promise.all([
    sql<{ count: string }>`SELECT COUNT(*) as count FROM slack_messages`,
    sql<{ count: string }>`SELECT COUNT(*) as count FROM releases`,
    sql<{ count: string }>`SELECT COUNT(*) as count FROM releases WHERE published = true`,
    sql<{ count: string }>`
      SELECT COUNT(*) as count FROM slack_messages m
      WHERE NOT EXISTS (SELECT 1 FROM releases r WHERE r.message_id = m.id)
    `,
  ])

  return {
    totalMessages: parseInt(messages.rows[0].count),
    totalReleases: parseInt(releases.rows[0].count),
    publishedReleases: parseInt(published.rows[0].count),
    messagesWithoutReleases: parseInt(unprocessed.rows[0].count),
  }
}
