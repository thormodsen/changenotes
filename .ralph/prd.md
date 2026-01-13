# PRD: Slack Release Monitor

## Overview

A CLI tool that fetches messages from a Slack channel, uses Claude to identify and summarize release/change information, and maintains a running markdown report. Designed to cut through Slack noise and extract what actually shipped.

## Goals

- Pull messages from a specific Slack channel using Slack user token
- Track processed messages to avoid duplicates
- Use Claude API to extract meaningful release/change info
- Maintain a running `releases.md` log
- Generate weekly summary on demand via `--weekly-summary` flag

## Non-Goals (Out of Scope)

- Real-time monitoring (batch job, not always-on)
- Posting back to Slack
- Web dashboard or database
- Email notifications
- Automatic scheduling (manual trigger for now)
- Multi-channel support (single channel per run)

## Technical Decisions

- **Language:** TypeScript (Vercel-compatible for future deployment)
- **LLM:** Anthropic Claude API
- **Dedup:** Message ID tracking in local state file
- **Output:** Markdown files (releases.md, weekly summaries)

## User Stories

### US-001: Project Setup
**Description:** As a developer, I want a properly configured TypeScript project so that I can build the CLI tool.

**Acceptance Criteria:**
- [ ] TypeScript project with tsconfig.json
- [ ] Package.json with necessary dependencies (@anthropic-ai/sdk, @slack/web-api)
- [ ] ESLint configured
- [ ] Build script produces executable
- [ ] .gitignore covers node_modules, dist, .env

### US-002: Configuration Management
**Description:** As a user, I want to configure the tool via environment variables so that I don't hardcode secrets.

**Acceptance Criteria:**
- [ ] Reads SLACK_TOKEN from environment
- [ ] Reads ANTHROPIC_API_KEY from environment
- [ ] Reads SLACK_CHANNEL_ID from environment
- [ ] Clear error messages when config is missing
- [ ] Example .env.example file provided

### US-003: Slack Message Fetching
**Description:** As a user, I want to fetch messages from a Slack channel so that I have raw data to process.

**Acceptance Criteria:**
- [ ] Connects to Slack using user token
- [ ] Fetches messages from configured channel
- [ ] Handles pagination for channels with many messages
- [ ] Returns message text, timestamp, and user info
- [ ] Graceful error handling for API failures

### US-004: Message State Tracking
**Description:** As a user, I want the tool to remember which messages it has processed so that I don't get duplicates.

**Acceptance Criteria:**
- [ ] Stores processed message IDs in local JSON file (.release-monitor-state.json)
- [ ] Filters out already-processed messages before LLM call
- [ ] Updates state file after successful processing
- [ ] State file is gitignored by default

### US-005: LLM Release Extraction
**Description:** As a user, I want Claude to analyze messages and extract release/change information so that I get signal from noise.

**Acceptance Criteria:**
- [ ] Sends batch of messages to Claude API
- [ ] Prompt instructs Claude to identify releases, deployments, and changes
- [ ] Returns structured data: date, title, description, relevant links
- [ ] Ignores chatter, questions, and non-release content
- [ ] Handles case where no releases are found

### US-006: Markdown Report Generation
**Description:** As a user, I want releases appended to a markdown file so that I have a running log.

**Acceptance Criteria:**
- [ ] Creates releases.md if it doesn't exist
- [ ] Appends new releases with date headers
- [ ] Format: `## [Date] - [Title]` followed by description
- [ ] Preserves existing content (append-only)
- [ ] Includes source message links when available

### US-007: CLI Interface
**Description:** As a user, I want a simple CLI interface so that I can run the tool easily.

**Acceptance Criteria:**
- [ ] Runnable via `npx tsx src/index.ts` or built binary
- [ ] `--help` shows usage
- [ ] Default behavior: fetch new messages, extract releases, append to releases.md
- [ ] Exit code 0 on success, non-zero on failure
- [ ] Quiet by default, `--verbose` for debug output

### US-008: Weekly Summary Generation
**Description:** As a user, I want to generate a weekly summary so that I can share a digest with my team.

**Acceptance Criteria:**
- [ ] `--weekly-summary` flag triggers summary mode
- [ ] Reads releases.md and extracts last 7 days of entries
- [ ] Sends to Claude for summarization
- [ ] Outputs to weekly-summary-[YYYY-MM-DD].md
- [ ] Summary includes: highlights, themes, and count of releases

## Technical Notes

- Slack user token (xoxp-*) required, not bot token
- Rate limiting: Slack has 1 req/sec tier limits, add delays if needed
- Claude model: claude-sonnet-4-20250514 for cost/speed balance
- State file should be relative to current working directory
