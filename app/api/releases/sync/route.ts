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

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = searchParams.get('days')
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    const slackConfig = loadSlackConfig()

    await initializeSchema()

    // Calculate time window
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
      // Default: last 7 days
      oldest = Date.now() - 7 * 24 * 60 * 60 * 1000
    }

    // Fetch messages from Slack
    const allMessages = await fetchSlackMessages({ oldest, latest })
    console.log(`Fetched ${allMessages.length} messages from Slack`)

    // Get existing releases to check for edits
    let existingReleases = await getExistingReleaseMessageIds(slackConfig.channelId)

    // Find edited messages and delete their releases (plus entire thread)
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

    // Re-fetch existing releases after deletions (thread members are now "new")
    if (editedMessageIds.length > 0) {
      existingReleases = await getExistingReleaseMessageIds(slackConfig.channelId)
    }

    // Find all messages that need processing (new or had releases deleted)
    const messagesToProcess: SlackApiMessage[] = []
    for (const msg of allMessages) {
      if (!existingReleases.has(msg.ts)) {
        messagesToProcess.push(msg)
      }
    }

    console.log(
      `Processing ${messagesToProcess.length} messages (${editedMessageIds.length} edited)`
    )

    // Extract releases
    if (messagesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        fetched: allMessages.length,
        processed: 0,
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

    // Insert extracted releases
    let inserted = 0
    for (const release of releases) {
      const id = await insertRelease(release)
      if (id) inserted++
    }

    return NextResponse.json({
      success: true,
      fetched: allMessages.length,
      processed: messagesToProcess.length,
      extracted: inserted,
      skipped: skippedIds.length,
      edited: editedMessageIds.length,
      promptVersion,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Sync error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const maxDuration = 300 // 5 minutes for large syncs
