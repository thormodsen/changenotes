import { NextRequest, NextResponse } from 'next/server'
import { getReleaseById, deleteReleasesForMessage, insertRelease } from '@/lib/db/client'
import { loadSlackConfig } from '@/lib/config'
import { fetchThreadReplies } from '@/lib/slack'
import { extractReleasesFromMessages } from '@/lib/extraction'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const slackConfig = loadSlackConfig()

    // Get the release to find the message_id
    const release = await getReleaseById(id)
    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const messageId = release.message_id
    const threadTs = release.thread_ts || messageId

    // Delete all releases for this message and thread
    const deleted = await deleteReleasesForMessage(messageId)

    // Fetch the thread from Slack (includes parent and all replies)
    const messages = await fetchThreadReplies(threadTs)
    if (messages.length === 0) {
      return NextResponse.json({
        error: 'Could not fetch message from Slack'
      }, { status: 404 })
    }

    // Filter out excluded bots
    const filteredMessages = messages.filter(
      msg => !msg.bot_id || !slackConfig.excludeBotIds.includes(msg.bot_id)
    )

    // Extract releases
    const { releases, promptVersion, skippedIds, errors } = await extractReleasesFromMessages(
      filteredMessages,
      slackConfig.channelId
    )

    // Insert extracted releases and collect details
    const extractedReleases: { title: string; date: string }[] = []
    for (const rel of releases) {
      const newId = await insertRelease(rel)
      if (newId) {
        extractedReleases.push({ title: rel.title, date: rel.date })
      }
    }

    // Log summary to server
    console.log(`Re-extract complete:`)
    console.log(`  Messages read: ${filteredMessages.length}`)
    console.log(`  Messages skipped: ${skippedIds.length}`)
    console.log(`  Releases extracted: ${extractedReleases.length}`)
    if (extractedReleases.length > 0) {
      console.log(`  Extracted releases:`)
      for (const r of extractedReleases) {
        console.log(`    • ${r.date}: ${r.title}`)
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      messagesRead: filteredMessages.length,
      messagesSkipped: skippedIds.length,
      extracted: extractedReleases.length,
      extractedReleases,
      promptVersion,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Re-extract error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
