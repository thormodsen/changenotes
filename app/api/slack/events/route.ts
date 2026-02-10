import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { waitUntil } from '@vercel/functions'
import { processSingleMessage } from '@/lib/process-message'
import { loadSlackConfig } from '@/lib/config'
import type { SlackApiMessage } from '@/lib/slack'

// Slack event types
interface SlackUrlVerification {
  type: 'url_verification'
  challenge: string
  token: string
}

interface SlackEventCallback {
  type: 'event_callback'
  event: SlackMessageEvent | SlackMessageChangedEvent
  event_id: string
  event_time: number
  team_id: string
}

interface SlackMessageEvent {
  type: 'message'
  subtype?: string
  text?: string
  user?: string
  bot_id?: string
  ts: string
  thread_ts?: string
  channel: string
  channel_type?: string
  edited?: { user: string; ts: string }
  files?: SlackApiMessage['files']
}

interface SlackMessageChangedEvent {
  type: 'message'
  subtype: 'message_changed'
  channel: string
  ts: string
  message: SlackMessageEvent
  previous_message: SlackMessageEvent
}

type SlackEvent = SlackUrlVerification | SlackEventCallback

/**
 * Verify that the request came from Slack using the signing secret.
 */
function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Prevent replay attacks - reject requests older than 5 minutes
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false
  }

  const sigBaseString = `v0:${timestamp}:${body}`
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBaseString).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))
}

/**
 * Convert Slack event to SlackApiMessage format for processing.
 */
function eventToMessage(event: SlackMessageEvent): SlackApiMessage {
  return {
    ts: event.ts,
    text: event.text,
    user: event.user,
    bot_id: event.bot_id,
    subtype: event.subtype,
    thread_ts: event.thread_ts,
    edited: event.edited,
    files: event.files,
  }
}

/**
 * Process the incoming message event asynchronously.
 */
async function handleMessageEvent(event: SlackMessageEvent, channelId: string): Promise<void> {
  console.log(`[Events] handleMessageEvent called for ${event.ts}`, {
    text: event.text?.substring(0, 50),
    user: event.user,
    bot_id: event.bot_id,
    thread_ts: event.thread_ts,
  })

  const config = loadSlackConfig()

  // Skip messages from excluded bots
  if (event.bot_id && config.excludeBotIds.includes(event.bot_id)) {
    console.log(`[Events] Skipping message from excluded bot: ${event.bot_id}`)
    return
  }

  // Skip message subtypes we don't care about
  const ignoredSubtypes = ['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose']
  if (event.subtype && ignoredSubtypes.includes(event.subtype)) {
    console.log(`[Events] Skipping message with subtype: ${event.subtype}`)
    return
  }

  console.log(`[Events] Processing message ${event.ts}...`)
  const message = eventToMessage(event)
  const result = await processSingleMessage(message, channelId)

  console.log(`[Events] Processed message ${event.ts}: ${result.reason}`, {
    releases: result.releases?.length ?? 0,
    error: result.error,
  })
}

export async function POST(request: NextRequest) {
  console.log('[Events] POST request received')

  const signingSecret = process.env.SLACK_SIGNING_SECRET

  if (!signingSecret) {
    console.error('[Events] SLACK_SIGNING_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Get headers for signature verification
  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')

  if (!timestamp || !signature) {
    return NextResponse.json({ error: 'Missing Slack headers' }, { status: 400 })
  }

  // Read body as text for signature verification
  const body = await request.text()

  // Verify signature
  if (!verifySlackSignature(signingSecret, signature, timestamp, body)) {
    console.warn('[Events] Invalid Slack signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  console.log('[Events] Signature verified')

  const payload: SlackEvent = JSON.parse(body)
  console.log('[Events] Payload type:', payload.type)

  // Handle URL verification challenge
  if (payload.type === 'url_verification') {
    console.log('[Events] URL verification challenge')
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Handle event callbacks
  if (payload.type === 'event_callback') {
    const { event } = payload
    console.log('[Events] Event callback:', event.type, 'subtype:', event.subtype)

    // Only process messages from our configured channel
    const config = loadSlackConfig()
    const eventChannel = 'channel' in event ? event.channel : null

    console.log(`[Events] Event channel: ${eventChannel}, configured: ${config.channelId}`)

    if (eventChannel !== config.channelId) {
      console.log('[Events] Ignoring event from different channel')
      return NextResponse.json({ ok: true })
    }

    // Handle message_changed (edits)
    if (event.subtype === 'message_changed') {
      const changedEvent = event as SlackMessageChangedEvent
      // Process the updated message
      waitUntil(handleMessageEvent(changedEvent.message, config.channelId))
      return NextResponse.json({ ok: true })
    }

    // Handle regular messages (not message_changed, which was handled above)
    if (event.type === 'message' && event.subtype !== 'message_changed') {
      waitUntil(handleMessageEvent(event as SlackMessageEvent, config.channelId))
      return NextResponse.json({ ok: true })
    }
  }

  return NextResponse.json({ ok: true })
}

// Increase timeout for async processing
export const maxDuration = 60
