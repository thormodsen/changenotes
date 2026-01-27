import { NextRequest } from 'next/server'
import { getReleaseById, deleteReleasesForMessage, insertRelease, type Release } from '@/lib/db/client'
import { loadSlackConfig } from '@/lib/config'
import { fetchThreadReplies } from '@/lib/slack'
import { extractReleasesFromMessages } from '@/lib/extraction'
import { apiSuccess, apiNotFound, apiServerError } from '@/lib/api-response'

interface ReextractResult {
  deleted: number
  messagesRead: number
  messagesSkipped: number
  extracted: number
  newReleases: Release[]
  promptVersion: string
  errors?: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const slackConfig = loadSlackConfig()

    const release = await getReleaseById(id)
    if (!release) {
      return apiNotFound('Release not found')
    }

    const messageId = release.message_id
    const threadTs = release.thread_ts || messageId

    const deleted = await deleteReleasesForMessage(messageId)

    const messages = await fetchThreadReplies(threadTs)
    if (messages.length === 0) {
      return apiNotFound('Could not fetch message from Slack')
    }

    const filteredMessages = messages.filter(
      msg => !msg.bot_id || !slackConfig.excludeBotIds.includes(msg.bot_id)
    )

    const { releases, promptVersion, skippedIds, errors } = await extractReleasesFromMessages(
      filteredMessages,
      slackConfig.channelId
    )

    const newReleases: Release[] = []
    for (const rel of releases) {
      const newId = await insertRelease(rel)
      if (newId) {
        const fullRelease = await getReleaseById(newId)
        if (fullRelease) {
          newReleases.push(fullRelease)
        }
      }
    }

    console.log(`Re-extract complete:`)
    console.log(`  Messages read: ${filteredMessages.length}`)
    console.log(`  Messages skipped: ${skippedIds.length}`)
    console.log(`  Releases extracted: ${newReleases.length}`)
    if (newReleases.length > 0) {
      console.log(`  Extracted releases:`)
      for (const r of newReleases) {
        console.log(`    • ${r.date}: ${r.title}`)
      }
    }

    return apiSuccess<ReextractResult>({
      deleted,
      messagesRead: filteredMessages.length,
      messagesSkipped: skippedIds.length,
      extracted: newReleases.length,
      newReleases,
      promptVersion,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    return apiServerError(err)
  }
}
