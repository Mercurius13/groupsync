import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
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

    const existingTask = await prisma.task.findFirst({
      where: { id: params.taskId, projectId: params.id },
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, status, deadline, assigneeIds } = body

    const previousStatus = existingTask.status

    const task = await prisma.task.update({
      where: { id: params.taskId },
      data: {
        title: title ?? existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        status: status ?? existingTask.status,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : existingTask.deadline,
      },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    // Handle assignee updates
    if (assigneeIds !== undefined) {
      await prisma.taskAssignment.deleteMany({ where: { taskId: params.taskId } })
      if (assigneeIds.length > 0) {
        await prisma.taskAssignment.createMany({
          data: assigneeIds.map((userId: string) => ({ taskId: params.taskId, userId })),
        })
        await prisma.activityLog.create({
          data: {
            projectId: params.id,
            userId: session.userId,
            actionType: 'TASK_ASSIGNED',
            description: `${session.name} updated assignees for task "${task.title}"`,
            taskId: task.id,
          },
        })
      }
    }

    // Log status change
    if (status && status !== previousStatus) {
      const actionType = status === 'DONE' ? 'TASK_COMPLETED' : 'TASK_UPDATED'
      const description =
        status === 'DONE'
          ? `${session.name} completed task "${task.title}"`
          : `${session.name} updated task "${task.title}" status to ${status}`

      await prisma.activityLog.create({
        data: {
          projectId: params.id,
          userId: session.userId,
          actionType,
          description,
          taskId: task.id,
        },
      })
    } else if (!status) {
      await prisma.activityLog.create({
        data: {
          projectId: params.id,
          userId: session.userId,
          actionType: 'TASK_UPDATED',
          description: `${session.name} updated task "${task.title}"`,
          taskId: task.id,
        },
      })
    }

    // Refetch with updated assignments
    const updatedTask = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    console.error('Task PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } })
    if (!project || project.leaderId !== session.userId) {
      return NextResponse.json({ error: 'Only the project leader can delete tasks' }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: params.taskId, projectId: params.id },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await prisma.task.delete({ where: { id: params.taskId } })

    await prisma.activityLog.create({
      data: {
        projectId: params.id,
        userId: session.userId,
        actionType: 'TASK_UPDATED',
        description: `${session.name} deleted task "${task.title}"`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
