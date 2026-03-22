import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const invite = await prisma.invite.findUnique({
      where: { id: params.id },
      include: { project: { select: { id: true, title: true } } },
    })

    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (invite.email !== session.email) return NextResponse.json({ error: 'This invite is not for you' }, { status: 403 })
    if (invite.accepted) return NextResponse.json({ error: 'Already accepted' }, { status: 409 })
    if (new Date() > invite.expiresAt) return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })

    // Always look up the user by email from the DB — avoids stale JWT userId issues
    const user = await prisma.user.findUnique({ where: { email: session.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check not already a member
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: invite.project.id, userId: user.id } },
    })
    if (existing) {
      await prisma.invite.update({ where: { id: invite.id }, data: { accepted: true } })
      return NextResponse.json({ projectId: invite.project.id })
    }

    await prisma.projectMember.create({
      data: { projectId: invite.project.id, userId: user.id, role: 'member' },
    })
    await prisma.invite.update({ where: { id: invite.id }, data: { accepted: true } })
    await prisma.activityLog.create({
      data: {
        projectId: invite.project.id,
        userId: user.id,
        actionType: 'MEMBER_ADDED',
        description: `${user.name} joined the project via invitation`,
      },
    })

    return NextResponse.json({ projectId: invite.project.id })
  } catch (error) {
    console.error('Invite accept error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
