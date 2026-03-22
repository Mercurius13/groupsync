import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const tasks = await prisma.task.findMany({
      where: { projectId: params.id },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const body = await request.json()
    const { title, description, status, deadline, assigneeIds } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        projectId: params.id,
        title,
        description: description || null,
        status: status || 'TODO',
        deadline: deadline ? new Date(deadline) : null,
        assignments: assigneeIds && assigneeIds.length > 0
          ? {
              create: assigneeIds.map((userId: string) => ({ userId })),
            }
          : undefined,
      },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        projectId: params.id,
        userId: session.userId,
        actionType: 'TASK_CREATED',
        description: `${session.name} created task "${title}"`,
        taskId: task.id,
      },
    })

    if (assigneeIds && assigneeIds.length > 0) {
      await prisma.activityLog.create({
        data: {
          projectId: params.id,
          userId: session.userId,
          actionType: 'TASK_ASSIGNED',
          description: `${session.name} assigned task "${title}" to ${assigneeIds.length} member(s)`,
          taskId: task.id,
        },
      })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
