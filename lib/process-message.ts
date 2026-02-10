import {
  initializeSchema,
  getExistingReleaseMessageIds,
  insertRelease,
  deleteReleasesForMessage,
} from './db/client'
import { loadSlackConfig } from './config'
import { fetchThreadReplies, type SlackApiMessage } from './slack'
import { extractReleasesFromMessages, type ExtractedRelease } from './extraction'
import { notifyNewReleases, type NotifiableRelease } from './slack-notify'

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
  console.log(`[ProcessMessage] Starting for ${message.ts}`, {
    text: message.text?.substring(0, 50),
    channelId,
  })

  try {
    await initializeSchema()

    const existingReleases = await getExistingReleaseMessageIds(channelId)
    const existingEditedTs = existingReleases.get(message.ts)

    console.log(`[ProcessMessage] Existing release for ${message.ts}:`, existingEditedTs !== undefined)

    // Check if already processed
    if (existingEditedTs !== undefined) {
      const currentEditedTs = message.edited?.ts || null

      // If not edited, skip
      if (currentEditedTs === existingEditedTs) {
        console.log(`[ProcessMessage] Already processed, skipping ${message.ts}`)
        return { processed: false, reason: 'already_exists' }
      }

      // Message was edited - delete old releases and re-extract
      console.log(`[ProcessMessage] Message ${message.ts} was edited, re-extracting`)
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
    console.log(`[ProcessMessage] Extracting from ${messagesToProcess.length} messages`)
    const { releases, errors } = await extractReleasesFromMessages(messagesToProcess, channelId)

    console.log(`[ProcessMessage] Extraction complete: ${releases.length} releases, ${errors.length} errors`)
    if (errors.length > 0) {
      console.log(`[ProcessMessage] Errors:`, errors)
    }

    // Filter to only releases from this specific message (not the parent)
    const messageReleases = releases.filter((r) => r.messageId === message.ts)
    console.log(`[ProcessMessage] Filtered to ${messageReleases.length} releases for message ${message.ts}`)

    if (messageReleases.length === 0) {
      console.log(`[ProcessMessage] No releases found, marking as not_release`)
      return { processed: true, reason: 'not_release' }
    }

    // Insert releases and collect IDs for notification
    console.log(`[ProcessMessage] Inserting ${messageReleases.length} releases`)
    const insertedReleases: NotifiableRelease[] = []
    for (const release of messageReleases) {
      const id = await insertRelease(release)
      if (id) {
        insertedReleases.push({
          id,
          title: release.title,
          description: release.description,
          images: release.media?.images?.map(img => ({ url: img.url, name: img.name })),
        })
      }
    }

    // Notify about new releases
    if (insertedReleases.length > 0) {
      console.log(`[ProcessMessage] Notifying about ${insertedReleases.length} releases`)
      await notifyNewReleases(insertedReleases)
    }

    const reason = existingEditedTs !== undefined ? 'edited_reextracted' : 'extracted'
    return { processed: true, reason, releases: messageReleases }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Failed to process message ${message.ts}:`, err)
    return { processed: false, reason: 'error', error: errorMessage }
  }
}
