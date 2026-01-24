import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST() {
  try {
    // Add skip_extraction column if it doesn't exist
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'slack_messages' AND column_name = 'skip_extraction'
        ) THEN
          ALTER TABLE slack_messages ADD COLUMN skip_extraction BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `

    return NextResponse.json({
      success: true,
      message: 'Migration completed: skip_extraction column added',
    })
  } catch (err) {
    console.error('Migration error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
