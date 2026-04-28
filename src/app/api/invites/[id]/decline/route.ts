import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const invite = await prisma.invite.findUnique({ where: { id: params.id } })

    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (invite.email !== session.email) return NextResponse.json({ error: 'This invite is not for you' }, { status: 403 })

    await prisma.invite.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
