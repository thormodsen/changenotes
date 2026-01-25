import { sql } from '@vercel/postgres'

// Types
export interface SlackMessage {
  id: string
  channel_id: string
  text: string
  timestamp: Date
  user_id: string | null
  username: string | null
  thread_ts: string | null
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
  message_timestamp?: Date
  channel_id?: string
  // Marketing fields for share cards
  marketing_title: string | null
  marketing_description: string | null
  marketing_why_this_matters: string | null
  shared: boolean
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

  // Add marketing columns if they don't exist
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'marketing_title'
      ) THEN
        ALTER TABLE releases ADD COLUMN marketing_title TEXT;
        ALTER TABLE releases ADD COLUMN marketing_description TEXT;
        ALTER TABLE releases ADD COLUMN marketing_why_this_matters TEXT;
      END IF;
    END $$;
  `

  // Add shared column if it doesn't exist
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'shared'
      ) THEN
        ALTER TABLE releases ADD COLUMN shared BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
  `

  // Add thread_ts column for easier thread linking
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'slack_messages' AND column_name = 'thread_ts'
      ) THEN
        ALTER TABLE slack_messages ADD COLUMN thread_ts TEXT;
      END IF;
    END $$;
  `

  // Backfill thread_ts from raw_json
  await sql`
    UPDATE slack_messages
    SET thread_ts = raw_json->>'thread_ts'
    WHERE thread_ts IS NULL AND raw_json->>'thread_ts' IS NOT NULL
  `

  // Add search_vector column for full-text search
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'search_vector'
      ) THEN
        ALTER TABLE releases ADD COLUMN search_vector tsvector;
      END IF;
    END $$;
  `

  // Populate search_vector for existing releases
  await sql`
    UPDATE releases
    SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    WHERE search_vector IS NULL
  `

  // Create or replace trigger function to auto-update search_vector
  await sql`
    CREATE OR REPLACE FUNCTION releases_search_vector_trigger() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `

  // Create trigger if not exists
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'releases_search_vector_update'
      ) THEN
        CREATE TRIGGER releases_search_vector_update
        BEFORE INSERT OR UPDATE ON releases
        FOR EACH ROW EXECUTE FUNCTION releases_search_vector_trigger();
      END IF;
    END $$;
  `

  // Create indexes (these are idempotent)
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON slack_messages(timestamp DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_message ON releases(message_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_date ON releases(date DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_published ON releases(published)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_search ON releases USING GIN(search_vector)`
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_thread_ts ON slack_messages(thread_ts)`
}

// Messages
export async function insertMessage(msg: {
  id: string
  channelId: string
  text: string
  timestamp: Date
  userId?: string
  username?: string
  threadTs?: string
  threadReplies?: ThreadReply[]
  rawJson?: Record<string, unknown>
}): Promise<boolean> {
  try {
    // Extract thread_ts from rawJson if not provided directly
    const threadTs = msg.threadTs ?? (msg.rawJson?.thread_ts as string | undefined) ?? null

    await sql`
      INSERT INTO slack_messages (id, channel_id, text, timestamp, user_id, username, thread_ts, thread_replies, raw_json)
      VALUES (
        ${msg.id},
        ${msg.channelId},
        ${msg.text},
        ${msg.timestamp.toISOString()},
        ${msg.userId ?? null},
        ${msg.username ?? null},
        ${threadTs},
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

export async function getReleaseById(id: string): Promise<Release | null> {
  const result = await sql<Release>`
    SELECT r.*, m.timestamp as message_timestamp
    FROM releases r
    INNER JOIN slack_messages m ON r.message_id = m.id
    WHERE r.id = ${id}
  `
  return result.rows[0] || null
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
  offset?: number
}): Promise<{ releases: Release[]; total: number }> {
  let whereClause = 'WHERE m.skip_extraction = FALSE'
  const params: unknown[] = []
  let paramIndex = 1

  if (options?.startDate) {
    whereClause += ` AND r.date >= $${paramIndex++}`
    params.push(options.startDate)
  }
  if (options?.endDate) {
    whereClause += ` AND r.date <= $${paramIndex++}`
    params.push(options.endDate)
  }
  if (options?.published !== undefined) {
    whereClause += ` AND r.published = $${paramIndex++}`
    params.push(options.published)
  }
  if (options?.promptVersion) {
    whereClause += ` AND r.prompt_version = $${paramIndex++}`
    params.push(options.promptVersion)
  }

  // Count query
  const countQuery = `
    SELECT COUNT(*) as count FROM releases r
    INNER JOIN slack_messages m ON r.message_id = m.id
    ${whereClause}
  `
  const countResult = await sql.query<{ count: string }>(countQuery, params)
  const total = parseInt(countResult.rows[0]?.count || '0')

  // Data query
  let dataQuery = `
    SELECT r.*, m.timestamp as message_timestamp, m.channel_id FROM releases r
    INNER JOIN slack_messages m ON r.message_id = m.id
    ${whereClause}
    ORDER BY r.date DESC, m.timestamp DESC
  `

  if (options?.limit) {
    dataQuery += ` LIMIT $${paramIndex++}`
    params.push(options.limit)
  }
  if (options?.offset) {
    dataQuery += ` OFFSET $${paramIndex++}`
    params.push(options.offset)
  }

  const result = await sql.query<Release>(dataQuery, params)
  return { releases: result.rows, total }
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

export async function setReleaseShared(id: string, shared: boolean): Promise<boolean> {
  try {
    await sql`UPDATE releases SET shared = ${shared} WHERE id = ${id}`
    return true
  } catch (err) {
    console.error('Failed to update shared status:', err)
    return false
  }
}

export async function updateRelease(
  id: string,
  updates: {
    title?: string
    description?: string
    type?: string
    whyThisMatters?: string
    impact?: string
    marketingTitle?: string
    marketingDescription?: string
    marketingWhyThisMatters?: string
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
    if (updates.marketingTitle !== undefined) {
      fields.push(`marketing_title = $${paramIndex++}`)
      params.push(updates.marketingTitle || null)
    }
    if (updates.marketingDescription !== undefined) {
      fields.push(`marketing_description = $${paramIndex++}`)
      params.push(updates.marketingDescription || null)
    }
    if (updates.marketingWhyThisMatters !== undefined) {
      fields.push(`marketing_why_this_matters = $${paramIndex++}`)
      params.push(updates.marketingWhyThisMatters || null)
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

export async function updateReleaseMarketing(
  id: string,
  marketing: {
    title: string
    description: string
    whyThisMatters: string
  }
): Promise<boolean> {
  try {
    await sql`
      UPDATE releases
      SET marketing_title = ${marketing.title},
          marketing_description = ${marketing.description},
          marketing_why_this_matters = ${marketing.whyThisMatters}
      WHERE id = ${id}
    `
    return true
  } catch (err) {
    console.error('Failed to update marketing fields:', err)
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

// Related releases

export interface RelatedRelease {
  id: string
  title: string
  type: string
  date: string
  description: string | null
  why_this_matters: string | null
  impact: string | null
}

/**
 * Find the parent release via Slack thread_ts.
 * If this release's source message is a thread reply, returns the release
 * that was extracted from the parent message.
 */
export async function getParentRelease(releaseId: string): Promise<RelatedRelease | null> {
  const result = await sql<RelatedRelease>`
    SELECT r.id, r.title, r.type, r.date, r.description, r.why_this_matters, r.impact
    FROM releases r
    INNER JOIN slack_messages parent_msg ON r.message_id = parent_msg.id
    WHERE parent_msg.id = (
      SELECT m.thread_ts
      FROM releases rel
      INNER JOIN slack_messages m ON rel.message_id = m.id
      WHERE rel.id = ${releaseId}
      AND m.thread_ts IS NOT NULL
      AND m.thread_ts != m.id
    )
    AND r.published = true
    LIMIT 1
  `
  return result.rows[0] || null
}

/**
 * Find sibling releases (other releases in the same thread).
 */
export async function getSiblingReleases(releaseId: string): Promise<RelatedRelease[]> {
  const result = await sql<RelatedRelease>`
    SELECT DISTINCT r.id, r.title, r.type, r.date, r.description, r.why_this_matters, r.impact
    FROM releases r
    INNER JOIN slack_messages m ON r.message_id = m.id
    WHERE m.thread_ts = (
      SELECT COALESCE(msg.thread_ts, msg.id)
      FROM releases rel
      INNER JOIN slack_messages msg ON rel.message_id = msg.id
      WHERE rel.id = ${releaseId}
    )
    AND r.id != ${releaseId}
    AND r.published = true
    ORDER BY r.date DESC
    LIMIT 10
  `
  return result.rows
}

/**
 * Find related releases via full-text search on title and description.
 * Uses PostgreSQL's built-in text search with stemming.
 */
export async function getRelatedReleases(
  releaseId: string,
  limit = 5
): Promise<RelatedRelease[]> {
  const result = await sql<RelatedRelease>`
    WITH current_release AS (
      SELECT title, description, search_vector
      FROM releases
      WHERE id = ${releaseId}
    )
    SELECT r.id, r.title, r.type, r.date, r.description, r.why_this_matters, r.impact,
           ts_rank(r.search_vector, plainto_tsquery('english', cr.title)) as rank
    FROM releases r, current_release cr
    WHERE r.id != ${releaseId}
    AND r.published = true
    AND r.search_vector @@ plainto_tsquery('english', cr.title)
    ORDER BY rank DESC
    LIMIT ${limit}
  `
  return result.rows
}

/**
 * Get all linked releases for a given release:
 * - Parent release (if this is a thread reply)
 * - Sibling releases (other releases in same thread)
 * - Related releases (via keyword matching)
 */
export async function getLinkedReleases(releaseId: string): Promise<{
  parent: RelatedRelease | null
  siblings: RelatedRelease[]
  related: RelatedRelease[]
}> {
  const [parent, siblings, related] = await Promise.all([
    getParentRelease(releaseId),
    getSiblingReleases(releaseId),
    getRelatedReleases(releaseId),
  ])

  // Filter out siblings from related to avoid duplicates
  const siblingIds = new Set(siblings.map(s => s.id))
  if (parent) siblingIds.add(parent.id)
  const filteredRelated = related.filter(r => !siblingIds.has(r.id))

  return { parent, siblings, related: filteredRelated }
}
