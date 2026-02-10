import { NextRequest, NextResponse } from 'next/server'
import {
  initializeSchema,
  getExistingReleaseMessageIds,
  getKnownThreadIds,
  insertRelease,
  deleteReleasesForMessage,
} from '@/lib/db/client'
import { loadSlackConfig } from '@/lib/config'
import { fetchSlackMessages, fetchMissingParents, fetchRecentThreadReplies, type SlackApiMessage } from '@/lib/slack'
import { extractReleasesFromMessages } from '@/lib/extraction'
import { notifyNewReleases, type NotifiableRelease } from '@/lib/slack-notify'

interface SyncResult {
  fetched: number
  alreadyExtracted: number
  newMessages: number
  extracted: number
  skipped: number
  edited: number
  promptVersion: string
  errors?: string[]
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel injects this for cron jobs)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const slackConfig = loadSlackConfig()
    await initializeSchema()

    // Look back 24 hours
    const oldest = Date.now() - 24 * 60 * 60 * 1000

    // Fetch messages from channel history
    const fetchedMessages = await fetchSlackMessages({ oldest })

    // Also fetch recent replies to known threads (they don't appear in history)
    const knownThreads = await getKnownThreadIds(slackConfig.channelId)
    const recentReplies = await fetchRecentThreadReplies(knownThreads, { oldest })

    // Combine and deduplicate
    const combinedMessages = [...fetchedMessages, ...recentReplies]
    const seenTs = new Set<string>()
    const dedupedMessages = combinedMessages.filter(msg => {
      if (seenTs.has(msg.ts)) return false
      seenTs.add(msg.ts)
      return true
    })

    // Fetch missing parents for thread context
    const allMessages = await fetchMissingParents(dedupedMessages)
    console.log(`[Cron] Fetched ${fetchedMessages.length} messages + ${recentReplies.length} thread replies (${allMessages.length} total with parents)`)

    let existingReleases = await getExistingReleaseMessageIds(slackConfig.channelId)

    // Check for edited messages
    const editedMessageIds: string[] = []
    for (const msg of allMessages) {
      const existingEditedTs = existingReleases.get(msg.ts)
      if (existingEditedTs !== undefined) {
        const currentEditedTs = msg.edited?.ts || null
        if (currentEditedTs !== existingEditedTs) {
          editedMessageIds.push(msg.ts)
          await deleteReleasesForMessage(msg.ts)
        }
      }
    }

    if (editedMessageIds.length > 0) {
      existingReleases = await getExistingReleaseMessageIds(slackConfig.channelId)
    }

    // Find new messages that need processing
    const newMessageIds = new Set<string>()
    for (const msg of allMessages) {
      if (!existingReleases.has(msg.ts)) {
        newMessageIds.add(msg.ts)
      }
    }

    // Include parent messages for context even if already extracted
    // (needed for classification and extraction of thread replies)
    const parentTsNeeded = new Set<string>()
    for (const msg of allMessages) {
      if (newMessageIds.has(msg.ts) && msg.thread_ts && msg.thread_ts !== msg.ts) {
        parentTsNeeded.add(msg.thread_ts)
      }
    }

    const messagesToProcess: SlackApiMessage[] = []
    for (const msg of allMessages) {
      if (newMessageIds.has(msg.ts) || parentTsNeeded.has(msg.ts)) {
        messagesToProcess.push(msg)
      }
    }

    console.log(
      `[Cron] Processing ${newMessageIds.size} new messages (${parentTsNeeded.size} parents for context, ${editedMessageIds.length} edited)`
    )

    const alreadyExtracted = allMessages.length - newMessageIds.size

    if (newMessageIds.size === 0) {
      const result: SyncResult = {
        fetched: allMessages.length,
        alreadyExtracted,
        newMessages: 0,
        extracted: 0,
        skipped: 0,
        edited: 0,
        promptVersion: 'n/a',
      }
      return NextResponse.json({ ok: true, result })
    }

    const { releases, promptVersion, skippedIds, errors } = await extractReleasesFromMessages(
      messagesToProcess,
      slackConfig.channelId
    )

    // Only insert releases for new messages (not context-only parents)
    const insertedReleases: NotifiableRelease[] = []
    for (const release of releases) {
      if (!newMessageIds.has(release.messageId)) {
        continue // Skip releases for context-only parent messages
      }
      const id = await insertRelease(release)
      if (id) {
        insertedReleases.push({
          id,
          title: release.title,
          description: release.description,
          messageTs: release.messageId,
          channelId: release.channelId,
          threadTs: release.threadTs,
        })
      }
    }

    // Notify about new releases
    if (insertedReleases.length > 0) {
      await notifyNewReleases(insertedReleases)
    }

    const result: SyncResult = {
      fetched: allMessages.length,
      alreadyExtracted,
      newMessages: newMessageIds.size,
      extracted: insertedReleases.length,
      skipped: skippedIds.length,
      edited: editedMessageIds.length,
      promptVersion,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log('[Cron] Sync completed:', result)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[Cron] Sync failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// Allow up to 5 minutes for the cron job
export const maxDuration = 300
