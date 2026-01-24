import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SESSION_NAME = 'changelog_session'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_NAME)

  return NextResponse.json({ success: true })
}
