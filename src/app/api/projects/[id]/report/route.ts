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

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const reportData = await Promise.all(
      project.members.map(async (m) => {
        const assigned = await prisma.taskAssignment.count({
          where: { userId: m.userId, task: { projectId: params.id } },
        })

        const completed = await prisma.taskAssignment.count({
          where: {
            userId: m.userId,
            task: { projectId: params.id, status: 'DONE' },
          },
        })

        const activityCount = await prisma.activityLog.count({
          where: { projectId: params.id, userId: m.userId },
        })

        return {
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
          tasksAssigned: assigned,
          tasksCompleted: completed,
          completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
          activityCount,
          isActive: activityCount >= 3,
        }
      })
    )

    return NextResponse.json({ report: reportData, project: { id: project.id, title: project.title } })
  } catch (error) {
    console.error('Report GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
