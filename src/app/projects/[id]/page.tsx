'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProjectLayout from '@/components/ProjectLayout'
import { formatDate, formatDateTime, getActionIcon, isOverdue } from '@/lib/utils'
import Link from 'next/link'

interface Member {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface Task {
  id: string
  title: string
  status: string
  deadline: string | null
  assignments: { user: { id: string; name: string } }[]
}

interface ActivityLog {
  id: string
  actionType: string
  description: string
  createdAt: string
  user: { id: string; name: string }
}

interface Project {
  id: string
  title: string
  description: string | null
  createdAt: string
  leader: { id: string; name: string; email: string }
  members: Member[]
  tasks: Task[]
  activityLog: ActivityLog[]
  upcomingDeadlines: Task[]
  taskStats: {
    total: number
    done: number
    inProgress: number
    todo: number
    completionPercent: number
  }
}

export default function ProjectOverviewPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('student')
  const [addMemberInput, setAddMemberInput] = useState('')
  const [addMemberResults, setAddMemberResults] = useState<{ ok: string[]; fail: { email: string; reason: string }[] } | null>(null)
  const [addingMember, setAddingMember] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  async function fetchProject() {
    try {
      const [projectRes, meRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch('/api/auth/me'),
      ])
      const [projectData, meData] = await Promise.all([projectRes.json(), meRes.json()])
      if (projectData.project) setProject(projectData.project)
      if (meData.user) {
        setCurrentUserId(meData.user.id)
        setCurrentUserRole(meData.user.role)
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [projectId])

  async function handleRemoveMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this project? Their task assignments will also be cleared.`)) return
    setRemovingMemberId(userId)
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) alert(data.error || 'Failed to remove member')
      else fetchProject()
    } catch {
      alert('Something went wrong.')
    } finally {
      setRemovingMemberId(null)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    setAddMemberResults(null)
    setAddingMember(true)

    const emails = addMemberInput
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    const ok: string[] = []
    const fail: { email: string; reason: string }[] = []

    await Promise.all(
      emails.map(async (email) => {
        try {
          const res = await fetch(`/api/projects/${projectId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const data = await res.json()
          if (res.status === 202) {
            // No account yet — invite sent
            ok.push(`${email} (invite sent)`)
          } else if (!res.ok) {
            fail.push({ email, reason: data.error || 'Failed' })
          } else {
            ok.push(data.member?.user?.name ?? email)
          }
        } catch {
          fail.push({ email, reason: 'Something went wrong' })
        }
      })
    )

    setAddMemberResults({ ok, fail })
    if (ok.length > 0) {
      setAddMemberInput('')
      fetchProject()
    }
    setAddingMember(false)
  }

  if (loading) {
    return (
      <ProjectLayout projectId={projectId}>
        <div className="flex items-center justify-center py-20 text-gray-400">Loading project...</div>
      </ProjectLayout>
    )
  }

  if (!project) {
    return (
      <ProjectLayout projectId={projectId}>
        <div className="flex items-center justify-center py-20 text-gray-400">Project not found.</div>
      </ProjectLayout>
    )
  }

  return (
    <ProjectLayout projectId={projectId} projectTitle={project.title}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Title & Description */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
              {project.description && (
                <p className="text-gray-500 mt-2">{project.description}</p>
              )}
              <p className="text-sm text-gray-400 mt-2">
                Created {formatDate(project.createdAt)} by {project.leader.name}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 font-medium">Overall Progress</span>
              <span className="text-gray-900 font-semibold">{project.taskStats.completionPercent}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${project.taskStats.completionPercent}%` }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                {project.taskStats.todo} To Do
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                {project.taskStats.inProgress} In Progress
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {project.taskStats.done} Done
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Members */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Team Members</h2>
            <div className="space-y-3 mb-5">
              {project.members.map((m) => {
                const isProjectLeader = m.user.id === project.leader.id
                const canRemove = (currentUserId === project.leader.id || currentUserRole === 'teacher') && !isProjectLeader
                return (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-semibold">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.user.name}</p>
                        <p className="text-xs text-gray-400">{m.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        m.role === 'leader' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {m.role}
                      </span>
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveMember(m.user.id, m.user.name)}
                          disabled={removingMemberId === m.user.id}
                          className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Remove member"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add member form */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Add Members</p>
              {addMemberResults && (
                <div className="mb-2 space-y-1">
                  {addMemberResults.ok.map((name) => (
                    <p key={name} className="text-xs text-green-600">✓ {name} added</p>
                  ))}
                  {addMemberResults.fail.map(({ email, reason }) => (
                    <p key={email} className="text-xs text-red-600">✗ {email} — {reason}</p>
                  ))}
                </div>
              )}
              <form onSubmit={handleAddMember} className="flex gap-2">
                <input
                  type="text"
                  value={addMemberInput}
                  onChange={(e) => setAddMemberInput(e.target.value)}
                  placeholder="one@uni.edu, two@uni.edu, ..."
                  required
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={addingMember}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {addingMember ? '...' : 'Add'}
                </button>
              </form>
              <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Upcoming Deadlines</h2>
              <Link
                href={`/projects/${projectId}/tasks`}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                View all
              </Link>
            </div>
            {project.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {project.upcomingDeadlines.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isOverdue(task.deadline) ? 'bg-red-50 border border-red-100' : 'bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      {task.assignments.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {task.assignments.map((a) => a.user.name).join(', ')}
                        </p>
                      )}
                    </div>
                    {task.deadline && (
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        isOverdue(task.deadline) ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {formatDate(task.deadline)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
            <Link
              href={`/projects/${projectId}/activity`}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              View all
            </Link>
          </div>
          {project.activityLog.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {project.activityLog.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{getActionIcon(log.actionType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{log.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProjectLayout>
  )
}
