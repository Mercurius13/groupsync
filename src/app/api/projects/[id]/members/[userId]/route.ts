import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Only leader or teacher can remove members
    const isLeader = project.leaderId === session.userId
    const isTeacher = session.role === 'teacher'
    if (!isLeader && !isTeacher) {
      return NextResponse.json({ error: 'Only the project leader or a teacher can remove members' }, { status: 403 })
    }

    // Cannot remove the project leader
    if (params.userId === project.leaderId) {
      return NextResponse.json({ error: 'The project leader cannot be removed' }, { status: 400 })
    }

    const memberToRemove = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: params.userId } },
      include: { user: { select: { name: true } } },
    })
    if (!memberToRemove) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Remove all their task assignments in this project (tasks become unassigned)
    const projectTaskIds = await prisma.task.findMany({
      where: { projectId: params.id },
      select: { id: true },
    })
    await prisma.taskAssignment.deleteMany({
      where: {
        userId: params.userId,
        taskId: { in: projectTaskIds.map((t) => t.id) },
      },
    })

    // Remove from project
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: params.id, userId: params.userId } },
    })

    await prisma.activityLog.create({
      data: {
        projectId: params.id,
        userId: session.userId,
        actionType: 'MEMBER_ADDED', // reusing closest type; description makes it clear
        description: `${session.name} removed ${memberToRemove.user.name} from the project`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
