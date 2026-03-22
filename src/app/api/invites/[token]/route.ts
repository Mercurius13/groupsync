import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const invite = await prisma.invite.findUnique({
      where: { token: params.token },
      include: { project: { select: { title: true, description: true } } },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }
    if (invite.accepted) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 410 })
    }
    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }

    return NextResponse.json({
      invite: {
        email: invite.email,
        projectTitle: invite.project.title,
        projectDescription: invite.project.description,
      },
    })
  } catch (error) {
    console.error('Invite GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
