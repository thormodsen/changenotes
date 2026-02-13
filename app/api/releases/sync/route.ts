import { NextRequest } from 'next/server'
import {
  initializeSchema,
  getExistingReleaseMessageIds,
  getKnownThreadIds,
  deleteReleasesForMessage,
} from '@/lib/db/client'
import { loadLangfuseConfig, loadSlackConfig } from '@/lib/config'
import { fetchSlackMessages, fetchMissingParents, fetchRecentThreadReplies } from '@/lib/slack'
import { processSingleMessage } from '@/lib/process-message'
import { fetchPrompt } from '@/lib/langfuse'
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

    console.log(`Processing ${newMessageIds.size} new messages (${editedMessageIds.length} edited)`)

    const alreadyExtracted = allMessages.length - newMessageIds.size

    if (newMessageIds.size === 0) {
      return apiSuccess<SyncResult>({
        fetched: allMessages.length,
        alreadyExtracted,
        newMessages: 0,
        extracted: 0,
        skipped: 0,
        edited: 0,
        promptVersion: 'unknown',
      })
    }

    // Best-effort prompt version (for UI reporting)
    let promptVersion = 'unknown'
    try {
      const prompt = await fetchPrompt(loadLangfuseConfig(), 'release-extraction')
      if (prompt?.version) promptVersion = prompt.version
    } catch {
      // Ignore prompt lookup failures; sync can still continue.
    }

    // Incremental processing: extract + insert one message at a time.
    const messagesToProcess = allMessages
      .filter((msg) => newMessageIds.has(msg.ts))
      .sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))

    let extracted = 0
    let skipped = 0
    const errors: string[] = []

    for (const message of messagesToProcess) {
      const result = await processSingleMessage(message, slackConfig.channelId)

      if (result.reason === 'extracted' || result.reason === 'edited_reextracted') {
        extracted += result.releases?.length ?? 0
      } else if (result.reason === 'not_release') {
        skipped += 1
      } else if (result.reason === 'error') {
        errors.push(`Message ${message.ts}: ${result.error || 'Unknown error'}`)
      }
    }

    return apiSuccess<SyncResult>({
      fetched: allMessages.length,
      alreadyExtracted,
      newMessages: newMessageIds.size,
      extracted,
      skipped,
      edited: editedMessageIds.length,
      promptVersion,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    return apiServerError(err)
  }
}

export const maxDuration = 300
