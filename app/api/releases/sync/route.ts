import { NextRequest } from 'next/server'
import {
  initializeSchema,
  getExistingReleaseMessageIds,
  insertRelease,
  deleteReleasesForMessage,
} from '@/lib/db/client'
import { loadSlackConfig } from '@/lib/config'
import { fetchSlackMessages, fetchMissingParents, type SlackApiMessage } from '@/lib/slack'
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

    const fetchedMessages = await fetchSlackMessages({ oldest, latest })
    const allMessages = await fetchMissingParents(fetchedMessages)
    console.log(`Fetched ${fetchedMessages.length} messages from Slack (${allMessages.length} with parents)`)

    let existingReleases = await getExistingReleaseMessageIds(slackConfig.channelId)

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

    const messagesToProcess: SlackApiMessage[] = []
    for (const msg of allMessages) {
      if (!existingReleases.has(msg.ts)) {
        messagesToProcess.push(msg)
      }
    }

    console.log(
      `Processing ${messagesToProcess.length} messages (${editedMessageIds.length} edited)`
    )

    const alreadyExtracted = allMessages.length - messagesToProcess.length

    if (messagesToProcess.length === 0) {
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

    const insertedReleases: NotifiableRelease[] = []
    for (const release of releases) {
      const id = await insertRelease(release)
      if (id) {
        insertedReleases.push({ id, title: release.title, type: release.type })
      }
    }

    if (insertedReleases.length > 0) {
      await notifyNewReleases(insertedReleases)
    }

    return apiSuccess<SyncResult>({
      fetched: allMessages.length,
      alreadyExtracted,
      newMessages: messagesToProcess.length,
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
