-- Slack messages (source of truth, immutable once fetched)
CREATE TABLE IF NOT EXISTS slack_messages (
  id TEXT PRIMARY KEY,                    -- slack ts (e.g., "1234567890.123456")
  channel_id TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,         -- parsed from slack ts
  user_id TEXT,
  username TEXT,
  thread_replies JSONB,                   -- array of reply objects
  raw_json JSONB,                         -- full slack message payload
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted releases (derived, can be regenerated)
CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL REFERENCES slack_messages(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,                     -- 'New Feature', 'Bug Fix', etc.
  why_this_matters TEXT,
  impact TEXT,
  prompt_version TEXT,                    -- tracks which prompt version produced this
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_channel ON slack_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON slack_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_releases_message ON releases(message_id);
CREATE INDEX IF NOT EXISTS idx_releases_date ON releases(date DESC);
CREATE INDEX IF NOT EXISTS idx_releases_published ON releases(published);
CREATE INDEX IF NOT EXISTS idx_releases_prompt_version ON releases(prompt_version);
