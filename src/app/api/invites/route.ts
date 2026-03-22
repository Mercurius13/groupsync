import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const invites = await prisma.invite.findMany({
      where: {
        email: session.email,
        accepted: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            leader: { select: { name: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ invites })
  } catch (error) {
    console.error('Invites GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
