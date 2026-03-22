import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendProjectInvite } from '@/lib/email'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: session.userId } },
    })

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Members GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const currentMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: session.userId } },
    })

    if (!currentMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const userToAdd = await prisma.user.findUnique({ where: { email } })
    if (!userToAdd) {
      const project = await prisma.project.findUnique({ where: { id: params.id }, select: { title: true } })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://groupsync.vercel.app'
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      const invite = await prisma.invite.create({
        data: { projectId: params.id, email, expiresAt },
      })
      await sendProjectInvite({
        toEmail: email,
        inviterName: session.name,
        projectTitle: project?.title ?? 'a project',
        appUrl,
        inviteToken: invite.token,
      })
      return NextResponse.json(
        { error: 'No account found for that email. An invitation has been sent.' },
        { status: 404 }
      )
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: userToAdd.id } },
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this project' }, { status: 409 })
    }

    const newMember = await prisma.projectMember.create({
      data: {
        projectId: params.id,
        userId: userToAdd.id,
        role: 'member',
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    await prisma.activityLog.create({
      data: {
        projectId: params.id,
        userId: session.userId,
        actionType: 'MEMBER_ADDED',
        description: `${session.name} added ${userToAdd.name} to the project`,
      },
    })

    return NextResponse.json({ member: newMember }, { status: 201 })
  } catch (error) {
    console.error('Members POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
