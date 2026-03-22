import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: session.userId },
      include: {
        project: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            tasks: true,
            leader: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    const projects = memberships.map((m) => {
      const totalTasks = m.project.tasks.length
      const doneTasks = m.project.tasks.filter((t) => t.status === 'DONE').length
      return {
        ...m.project,
        memberCount: m.project.members.length,
        taskCount: totalTasks,
        completedTaskCount: doneTasks,
        completionPercent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      }
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Projects GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, description } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        title,
        description: description || null,
        leaderId: session.userId,
        members: {
          create: {
            userId: session.userId,
            role: 'leader',
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        userId: session.userId,
        actionType: 'PROJECT_CREATED',
        description: `${session.name} created the project "${title}"`,
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Projects POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
