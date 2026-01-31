import {
  initializeSchema,
  getExistingReleaseMessageIds,
  insertRelease,
  deleteReleasesForMessage,
} from './db/client'
import { loadSlackConfig } from './config'
import { fetchThreadReplies, type SlackApiMessage } from './slack'
import { extractReleasesFromMessages, type ExtractedRelease } from './extraction'

interface ProcessResult {
  processed: boolean
  reason: 'already_exists' | 'not_release' | 'extracted' | 'edited_reextracted' | 'error'
  releases?: ExtractedRelease[]
  error?: string
}

/**
 * Fetch a single message by its timestamp from a thread.
 * Used to get parent message context for thread replies.
 */
async function fetchMessageByTs(threadTs: string): Promise<SlackApiMessage | null> {
  const messages = await fetchThreadReplies(threadTs)
  return messages.find((m) => m.ts === threadTs) || null
}

/**
 * Process a single Slack message through the extraction pipeline.
 * Handles:
 * - Deduplication (skips already processed messages)
 * - Edit detection (re-extracts if message was edited)
 * - Thread context (fetches parent for replies)
 * - Classification + extraction
 */
export async function processSingleMessage(
  message: SlackApiMessage,
  channelId: string
): Promise<ProcessResult> {
  try {
    await initializeSchema()

    const existingReleases = await getExistingReleaseMessageIds(channelId)
    const existingEditedTs = existingReleases.get(message.ts)

    // Check if already processed
    if (existingEditedTs !== undefined) {
      const currentEditedTs = message.edited?.ts || null

      // If not edited, skip
      if (currentEditedTs === existingEditedTs) {
        return { processed: false, reason: 'already_exists' }
      }

      // Message was edited - delete old releases and re-extract
      console.log(`Message ${message.ts} was edited, re-extracting`)
      await deleteReleasesForMessage(message.ts)
    }

    // Build message array with parent context if this is a thread reply
    const messagesToProcess: SlackApiMessage[] = []
    const isThreadReply = message.thread_ts && message.thread_ts !== message.ts

    if (isThreadReply && message.thread_ts) {
      const parentMessage = await fetchMessageByTs(message.thread_ts)
      if (parentMessage) {
        messagesToProcess.push(parentMessage)
      }
    }
    messagesToProcess.push(message)

    // Run through extraction pipeline
    const { releases, errors } = await extractReleasesFromMessages(messagesToProcess, channelId)

    // Filter to only releases from this specific message (not the parent)
    const messageReleases = releases.filter((r) => r.messageId === message.ts)

    if (messageReleases.length === 0) {
      return { processed: true, reason: 'not_release' }
    }

    // Insert releases
    for (const release of messageReleases) {
      await insertRelease(release)
    }

    const reason = existingEditedTs !== undefined ? 'edited_reextracted' : 'extracted'
    return { processed: true, reason, releases: messageReleases }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Failed to process message ${message.ts}:`, err)
    return { processed: false, reason: 'error', error: errorMessage }
  }
}
