import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/projects/[id]/tasks/distribute
// body: { mode: 'random' } | { mode: 'manual', assignments: { taskId: string, userIds: string[] }[] }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    const isLeader = project.leaderId === session.userId
    const isTeacher = session.role === 'teacher'
    if (!isLeader && !isTeacher) {
      return NextResponse.json({ error: 'Only the project leader or a teacher can distribute tasks' }, { status: 403 })
    }

    const body = await request.json()
    const { mode, assignments } = body

    if (mode === 'manual') {
      // assignments: [{ taskId, userIds }]
      for (const { taskId, userIds } of assignments as { taskId: string; userIds: string[] }[]) {
        await prisma.taskAssignment.deleteMany({ where: { taskId } })
        if (userIds.length > 0) {
          await prisma.taskAssignment.createMany({
            data: userIds.map((userId: string) => ({ taskId, userId })),
          })
        }
      }
      await prisma.activityLog.create({
        data: {
          projectId: params.id,
          userId: session.userId,
          actionType: 'TASK_ASSIGNED',
          description: `${session.name} manually assigned tasks to team members`,
        },
      })
    } else if (mode === 'random') {
      // Get unassigned tasks
      const unassignedTasks = await prisma.task.findMany({
        where: {
          projectId: params.id,
          assignments: { none: {} },
        },
        select: { id: true, title: true },
      })

      if (unassignedTasks.length === 0) {
        return NextResponse.json({ error: 'No unassigned tasks to distribute' }, { status: 400 })
      }

      const members = await prisma.projectMember.findMany({
        where: { projectId: params.id },
        select: { userId: true },
      })

      if (members.length === 0) {
        return NextResponse.json({ error: 'No members to assign tasks to' }, { status: 400 })
      }

      // Shuffle tasks, distribute round-robin across members
      const shuffled = [...unassignedTasks].sort(() => Math.random() - 0.5)
      const memberIds = members.map((m) => m.userId)

      const taskAssignments = shuffled.map((task, i) => ({
        taskId: task.id,
        userId: memberIds[i % memberIds.length],
      }))

      await prisma.taskAssignment.createMany({ data: taskAssignments })

      await prisma.activityLog.create({
        data: {
          projectId: params.id,
          userId: session.userId,
          actionType: 'TASK_ASSIGNED',
          description: `${session.name} randomly distributed ${shuffled.length} task(s) across ${memberIds.length} member(s)`,
        },
      })
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Distribute error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
