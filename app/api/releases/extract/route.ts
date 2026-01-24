import { NextRequest, NextResponse } from 'next/server'
import { getMessagesWithoutReleases, deleteReleasesForReextraction } from '@/lib/db/client'
import { extractReleasesFromMessages } from '@/lib/extraction'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reextract = searchParams.get('reextract') === 'true'

    // If reextract, we need to get the prompt version first to delete old releases
    if (reextract) {
      // Dummy call to get current prompt version - extraction will get it again
      const messages = await getMessagesWithoutReleases()
      if (messages.length > 0) {
        const result = await extractReleasesFromMessages([messages[0]])
        const deleted = await deleteReleasesForReextraction(result.promptVersion)
        console.log(`Deleted ${deleted} old releases for re-extraction`)
      }
    }

    // Get messages that need extraction
    const messages = await getMessagesWithoutReleases()

    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        extracted: 0,
        messagesProcessed: 0,
        promptVersion: 'unknown',
        message: 'No messages to process',
      })
    }

    const result = await extractReleasesFromMessages(messages)

    return NextResponse.json({
      success: true,
      messagesProcessed: messages.length,
      extracted: result.extracted,
      promptVersion: result.promptVersion,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (err) {
    console.error('Extract error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const maxDuration = 60
