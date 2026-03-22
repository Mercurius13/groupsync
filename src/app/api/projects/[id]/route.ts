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
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        leader: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        tasks: {
          include: {
            assignments: { include: { user: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activityLog: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const totalTasks = project.tasks.length
    const doneTasks = project.tasks.filter((t) => t.status === 'DONE').length
    const inProgressTasks = project.tasks.filter((t) => t.status === 'IN_PROGRESS').length
    const upcomingDeadlines = project.tasks
      .filter((t) => t.deadline && t.status !== 'DONE')
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 5)

    return NextResponse.json({
      project: {
        ...project,
        taskStats: {
          total: totalTasks,
          done: doneTasks,
          inProgress: inProgressTasks,
          todo: totalTasks - doneTasks - inProgressTasks,
          completionPercent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        },
        upcomingDeadlines,
      },
    })
  } catch (error) {
    console.error('Project GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
