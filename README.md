# Changenotes

A Next.js app that syncs release announcements from Slack, uses AI to extract structured release notes, and publishes a public changelog.

## Features

- **Slack Sync**: Fetches messages from a Slack channel, including thread replies
- **AI Extraction**: Uses Claude (via OpenRouter) to classify and extract release information
- **Prompt Management**: Prompts managed via Langfuse for easy iteration
- **Admin UI**: Filter by date, publish/unpublish releases, edit content, re-extract
- **Public Changelog**: Customer-facing changelog page at `/changelog`
- **Share Cards**: Generate shareable release cards with marketing copy

## Stack

- Next.js 14 (App Router)
- Vercel Postgres
- OpenRouter (Claude)
- Langfuse (prompt management)
- Tailwind CSS

## Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure:
   ```
   # Slack
   SLACK_TOKEN=xoxb-...
   SLACK_CHANNEL_ID=C...
   SLACK_WORKSPACE=yourworkspace

   # Database
   POSTGRES_URL=postgresql://...

   # AI
   OPENROUTER_API_KEY=sk-or-...

   # Prompts
   LANGFUSE_PUBLIC_KEY=pk-...
   LANGFUSE_SECRET_KEY=sk-...
   LANGFUSE_HOST=https://cloud.langfuse.com
   ```

3. Set up Langfuse prompts:
   - `release-classification`: Determines which messages are releases
   - `release-extraction`: Extracts structured data from release messages

4. Run locally:
   ```bash
   npm run dev
   ```

## Usage

1. **Sync**: Select date range and click "Sync & Extract"
2. **Review**: Edit titles, descriptions, or re-extract individual releases
3. **Publish**: Toggle publish status to show/hide on public changelog
4. **Share**: Generate marketing copy and shareable cards

## Routes

- `/` - Admin dashboard (requires auth)
- `/changelog` - Public changelog
- `/changelog/[id]` - Individual release page
- `/release/[id]` - Shareable release card

## Environment

Requires:
- Slack bot with `channels:history`, `channels:read` scopes
- Vercel Postgres database
- OpenRouter API key
- Langfuse account for prompt management
