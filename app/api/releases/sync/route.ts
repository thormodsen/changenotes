import { NextRequest } from 'next/server'
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
import { apiSuccess, apiServerError } from '@/lib/api-response'

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

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = searchParams.get('days')
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    const slackConfig = loadSlackConfig()

    await initializeSchema()

    let oldest: number | undefined
    let latest: number | undefined

    if (startDate) {
      oldest = new Date(startDate).getTime()
      if (endDate) {
        latest = new Date(endDate).getTime() + 24 * 60 * 60 * 1000
      }
    } else if (days) {
      const daysNum = parseInt(days, 10)
      oldest = Date.now() - daysNum * 24 * 60 * 60 * 1000
    } else {
      oldest = Date.now() - 7 * 24 * 60 * 60 * 1000
    }

    // Fetch messages from channel history
    const fetchedMessages = await fetchSlackMessages({ oldest, latest })

    // Also fetch recent replies to known threads (they don't appear in history)
    const knownThreads = await getKnownThreadIds(slackConfig.channelId)
    const recentReplies = await fetchRecentThreadReplies(knownThreads, { oldest, latest })

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
    console.log(`Fetched ${fetchedMessages.length} messages + ${recentReplies.length} thread replies (${allMessages.length} total with parents)`)

    let existingReleases = await getExistingReleaseMessageIds(slackConfig.channelId)

    // Collect edited messages first, then batch delete
    const editedMessageIds: string[] = []
    for (const msg of allMessages) {
      const existingEditedTs = existingReleases.get(msg.ts)
      if (existingEditedTs !== undefined) {
        const currentEditedTs = msg.edited?.ts || null
        if (currentEditedTs !== existingEditedTs) {
          editedMessageIds.push(msg.ts)
        }
      }
    }

    // Batch delete edited messages in parallel
    if (editedMessageIds.length > 0) {
      await Promise.all(editedMessageIds.map(id => deleteReleasesForMessage(id)))
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
      `Processing ${newMessageIds.size} new messages (${parentTsNeeded.size} parents for context, ${editedMessageIds.length} edited)`
    )

    const alreadyExtracted = allMessages.length - newMessageIds.size

    if (newMessageIds.size === 0) {
      return apiSuccess<SyncResult>({
        fetched: allMessages.length,
        alreadyExtracted,
        newMessages: 0,
        extracted: 0,
        skipped: 0,
        edited: 0,
        promptVersion: 'n/a',
      })
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
          images: release.media?.images?.map(img => ({ url: img.url, name: img.name })),
        })
      }
    }

    if (insertedReleases.length > 0) {
      await notifyNewReleases(insertedReleases)
    }

    return apiSuccess<SyncResult>({
      fetched: allMessages.length,
      alreadyExtracted,
      newMessages: newMessageIds.size,
      extracted: insertedReleases.length,
      skipped: skippedIds.length,
      edited: editedMessageIds.length,
      promptVersion,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    return apiServerError(err)
  }
}

export const maxDuration = 300
