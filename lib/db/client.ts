import { sql } from '@vercel/postgres'

// Types
export interface MediaImage {
  id: string
  url: string
  thumb_url?: string
  width?: number
  height?: number
  name?: string
}

export interface MediaVideo {
  id: string
  url: string
  mp4_url?: string
  thumb_url?: string
  duration_ms?: number
  name?: string
}

export interface ReleaseMedia {
  images: MediaImage[]
  videos: MediaVideo[]
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
  // Slack metadata (moved from slack_messages)
  message_timestamp: Date
  channel_id: string
  thread_ts: string | null
  edited_ts: string | null
  raw_json: Record<string, unknown> | null
  // Marketing fields for share cards
  marketing_title: string | null
  marketing_description: string | null
  marketing_why_this_matters: string | null
  shared: boolean
  // Media attachments from Slack
  media: ReleaseMedia | null
  include_media: boolean
  featured_image_url: string | null
}

// Initialize schema
export async function initializeSchema(): Promise<void> {
  // Create releases table (new schema without FK to slack_messages)
  await sql`
    CREATE TABLE IF NOT EXISTS releases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id TEXT NOT NULL,
      date DATE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      why_this_matters TEXT,
      impact TEXT,
      prompt_version TEXT,
      extracted_at TIMESTAMPTZ DEFAULT NOW(),
      published BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMPTZ,
      -- Slack metadata
      message_timestamp TIMESTAMPTZ NOT NULL,
      channel_id TEXT NOT NULL,
      thread_ts TEXT,
      edited_ts TEXT,
      raw_json JSONB,
      -- Marketing fields
      marketing_title TEXT,
      marketing_description TEXT,
      marketing_why_this_matters TEXT,
      shared BOOLEAN DEFAULT FALSE,
      -- Media
      media JSONB,
      include_media BOOLEAN DEFAULT TRUE,
      featured_image_url TEXT,
      -- Full-text search
      search_vector tsvector
    )
  `

  // Migration: Drop FK constraint if it exists (from old schema)
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'releases_message_id_fkey'
        AND table_name = 'releases'
      ) THEN
        ALTER TABLE releases DROP CONSTRAINT releases_message_id_fkey;
      END IF;
    END $$;
  `

  // Migration: Add new columns if they don't exist (for existing installations)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'message_timestamp'
      ) THEN
        ALTER TABLE releases ADD COLUMN message_timestamp TIMESTAMPTZ;
        ALTER TABLE releases ADD COLUMN channel_id TEXT;
        ALTER TABLE releases ADD COLUMN thread_ts TEXT;
        ALTER TABLE releases ADD COLUMN edited_ts TEXT;
        ALTER TABLE releases ADD COLUMN raw_json JSONB;
      END IF;
    END $$;
  `

  // Migration: Backfill from slack_messages if it exists
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'slack_messages'
      ) THEN
        UPDATE releases r
        SET
          message_timestamp = m.timestamp,
          channel_id = m.channel_id,
          thread_ts = m.thread_ts,
          raw_json = m.raw_json
        FROM slack_messages m
        WHERE r.message_id = m.id
        AND r.message_timestamp IS NULL;
      END IF;
    END $$;
  `

  // Add older columns if missing (for fresh installs that might have partial schema)
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
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'shared'
      ) THEN
        ALTER TABLE releases ADD COLUMN shared BOOLEAN DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'media'
      ) THEN
        ALTER TABLE releases ADD COLUMN media JSONB;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'include_media'
      ) THEN
        ALTER TABLE releases ADD COLUMN include_media BOOLEAN DEFAULT TRUE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'releases' AND column_name = 'featured_image_url'
      ) THEN
        ALTER TABLE releases ADD COLUMN featured_image_url TEXT;
      END IF;
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

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_message ON releases(message_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_date ON releases(date DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_published ON releases(published)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_search ON releases USING GIN(search_vector)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_thread_ts ON releases(thread_ts)`
  await sql`CREATE INDEX IF NOT EXISTS idx_releases_channel ON releases(channel_id)`
}

// Get existing release message IDs for deduplication
export async function getExistingReleaseMessageIds(channelId: string): Promise<Map<string, string | null>> {
  const result = await sql<{ message_id: string; edited_ts: string | null }>`
    SELECT message_id, edited_ts FROM releases WHERE channel_id = ${channelId}
  `
  return new Map(result.rows.map((r) => [r.message_id, r.edited_ts]))
}

export async function getReleasesByMessageId(messageId: string): Promise<Release[]> {
  const result = await sql<Release>`
    SELECT * FROM releases WHERE message_id = ${messageId}
  `
  return result.rows
}

export async function getReleaseById(id: string): Promise<Release | null> {
  const result = await sql<Release>`
    SELECT * FROM releases WHERE id = ${id}
  `
  return result.rows[0] || null
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
  media?: ReleaseMedia | null
  // New Slack metadata fields
  messageTimestamp: Date
  channelId: string
  threadTs?: string | null
  editedTs?: string | null
  rawJson?: Record<string, unknown> | null
}): Promise<string | null> {
  try {
    const result = await sql<{ id: string }>`
      INSERT INTO releases (
        message_id, date, title, description, type, why_this_matters, impact, prompt_version, media,
        message_timestamp, channel_id, thread_ts, edited_ts, raw_json
      )
      VALUES (
        ${release.messageId},
        ${release.date},
        ${release.title},
        ${release.description ?? null},
        ${release.type},
        ${release.whyThisMatters ?? null},
        ${release.impact ?? null},
        ${release.promptVersion ?? null},
        ${release.media ? JSON.stringify(release.media) : null},
        ${release.messageTimestamp.toISOString()},
        ${release.channelId},
        ${release.threadTs ?? null},
        ${release.editedTs ?? null},
        ${release.rawJson ? JSON.stringify(release.rawJson) : null}
      )
      RETURNING id
    `
    return result.rows[0]?.id ?? null
  } catch (err) {
    console.error('Failed to insert release:', err)
    return null
  }
}

// Delete releases for a message (used when re-extracting edited messages)
export async function deleteReleasesForMessage(messageId: string): Promise<number> {
  const result = await sql`DELETE FROM releases WHERE message_id = ${messageId}`
  return result.rowCount ?? 0
}

export async function getReleases(options?: {
  startDate?: string
  endDate?: string
  published?: boolean
  promptVersion?: string
  limit?: number
  offset?: number
}): Promise<{ releases: Release[]; total: number }> {
  let whereClause = 'WHERE 1=1'
  const params: unknown[] = []
  let paramIndex = 1

  if (options?.startDate) {
    whereClause += ` AND date >= $${paramIndex++}`
    params.push(options.startDate)
  }
  if (options?.endDate) {
    whereClause += ` AND date <= $${paramIndex++}`
    params.push(options.endDate)
  }
  if (options?.published !== undefined) {
    whereClause += ` AND published = $${paramIndex++}`
    params.push(options.published)
  }
  if (options?.promptVersion) {
    whereClause += ` AND prompt_version = $${paramIndex++}`
    params.push(options.promptVersion)
  }

  // Count query
  const countQuery = `SELECT COUNT(*) as count FROM releases ${whereClause}`
  const countResult = await sql.query<{ count: string }>(countQuery, params)
  const total = parseInt(countResult.rows[0]?.count || '0')

  // Data query
  let dataQuery = `
    SELECT * FROM releases
    ${whereClause}
    ORDER BY date DESC, message_timestamp DESC
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
    includeMedia?: boolean
    featuredImageUrl?: string | null
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
    if (updates.includeMedia !== undefined) {
      fields.push(`include_media = $${paramIndex++}`)
      params.push(updates.includeMedia)
    }
    if (updates.featuredImageUrl !== undefined) {
      fields.push(`featured_image_url = $${paramIndex++}`)
      params.push(updates.featuredImageUrl || null)
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
  totalReleases: number
  publishedReleases: number
  unpublishedReleases: number
}> {
  const [releases, published] = await Promise.all([
    sql<{ count: string }>`SELECT COUNT(*) as count FROM releases`,
    sql<{ count: string }>`SELECT COUNT(*) as count FROM releases WHERE published = true`,
  ])

  const total = parseInt(releases.rows[0].count)
  const pub = parseInt(published.rows[0].count)

  return {
    totalReleases: total,
    publishedReleases: pub,
    unpublishedReleases: total - pub,
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
    WHERE r.message_id = (
      SELECT thread_ts
      FROM releases
      WHERE id = ${releaseId}
      AND thread_ts IS NOT NULL
      AND thread_ts != message_id
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
    WHERE COALESCE(r.thread_ts, r.message_id) = (
      SELECT COALESCE(thread_ts, message_id)
      FROM releases
      WHERE id = ${releaseId}
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
