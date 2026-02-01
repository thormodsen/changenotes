import { NextRequest, NextResponse } from 'next/server'
import {
  initializeSchema,
  getExistingReleaseMessageIds,
  insertRelease,
  deleteReleasesForMessage,
} from '@/lib/db/client'
import { loadSlackConfig } from '@/lib/config'
import { fetchSlackMessages, type SlackApiMessage } from '@/lib/slack'
import { extractReleasesFromMessages } from '@/lib/extraction'
import { notifyNewReleases } from '@/lib/slack-notify'

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

    const allMessages = await fetchSlackMessages({ oldest })
    console.log(`[Cron] Fetched ${allMessages.length} messages from Slack`)

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

    // Filter to unprocessed messages
    const messagesToProcess: SlackApiMessage[] = []
    for (const msg of allMessages) {
      if (!existingReleases.has(msg.ts)) {
        messagesToProcess.push(msg)
      }
    }

    console.log(
      `[Cron] Processing ${messagesToProcess.length} messages (${editedMessageIds.length} edited)`
    )

    const alreadyExtracted = allMessages.length - messagesToProcess.length

    if (messagesToProcess.length === 0) {
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

    let inserted = 0
    for (const release of releases) {
      const id = await insertRelease(release)
      if (id) inserted++
    }

    // Notify about new releases
    if (releases.length > 0) {
      await notifyNewReleases(releases)
    }

    const result: SyncResult = {
      fetched: allMessages.length,
      alreadyExtracted,
      newMessages: messagesToProcess.length,
      extracted: inserted,
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
