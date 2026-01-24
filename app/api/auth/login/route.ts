import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SESSION_NAME = 'changelog_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD env var not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Create a simple session token (hash of password + timestamp for uniqueness)
  const sessionToken = Buffer.from(`${adminPassword}:${Date.now()}`).toString('base64')

  const cookieStore = await cookies()
  cookieStore.set(SESSION_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return NextResponse.json({ success: true })
}
