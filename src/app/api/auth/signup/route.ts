import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email: rawEmail, password, role, inviteToken } = body

    if (!name || !rawEmail || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }

    const email = rawEmail.toLowerCase().trim()
    const userRole = role === 'teacher' ? 'teacher' : 'student'

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    // Validate invite token before creating user
    let invite = null
    if (inviteToken) {
      invite = await prisma.invite.findUnique({
        where: { token: inviteToken },
        include: { project: { select: { id: true, title: true } } },
      })
      if (!invite || invite.accepted || new Date() > invite.expiresAt) {
        invite = null // treat as expired/invalid — still allow signup, just don't auto-join
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: userRole },
    })

    // Auto-join the project if invite is valid
    if (invite) {
      await prisma.projectMember.create({
        data: { projectId: invite.project.id, userId: user.id, role: 'member' },
      })
      await prisma.invite.update({
        where: { id: invite.id },
        data: { accepted: true },
      })
      await prisma.activityLog.create({
        data: {
          projectId: invite.project.id,
          userId: user.id,
          actionType: 'MEMBER_ADDED',
          description: `${user.name} joined the project via invitation`,
        },
      })
    }

    const token = await signToken({ userId: user.id, email: user.email, name: user.name, role: userRole })

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: userRole },
      joinedProject: invite ? { id: invite.project.id, title: invite.project.title } : null,
    })
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
