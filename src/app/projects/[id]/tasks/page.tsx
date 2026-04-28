'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProjectLayout from '@/components/ProjectLayout'
import { formatDate, isOverdue } from '@/lib/utils'

interface Member {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  deadline: string | null
  createdAt: string
  assignments: { user: { id: string; name: string; email: string } }[]
}

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DONE', label: 'Done' },
]

const columnColors: Record<TaskStatus, string> = {
  TODO: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
}

export default function TasksPage() {
  const params = useParams()
  const projectId = params.id as string

  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [projectTitle, setProjectTitle] = useState('')
  const [isLeader, setIsLeader] = useState(false)
  const [isTeacher, setIsTeacher] = useState(false)

  // New task form
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Distribute panel
  const [showDistribute, setShowDistribute] = useState(false)
  const [distributeMode, setDistributeMode] = useState<'manual' | 'random' | null>(null)
  // manual mode: map of taskId -> selected userIds
  const [manualAssignments, setManualAssignments] = useState<Record<string, string[]>>({})
  const [distributeLoading, setDistributeLoading] = useState(false)
  const [distributeError, setDistributeError] = useState('')

  // Edit task (leader only)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState<TaskStatus>('TODO')
  const [editDeadline, setEditDeadline] = useState('')
  const [editAssignees, setEditAssignees] = useState<string[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  async function fetchData() {
    try {
      const [tasksRes, projectRes, membersRes, meRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/members`),
        fetch('/api/auth/me'),
      ])
      const [tasksData, projectData, membersData, meData] = await Promise.all([
        tasksRes.json(),
        projectRes.json(),
        membersRes.json(),
        meRes.json(),
      ])
      if (tasksData.tasks) setTasks(tasksData.tasks)
      if (projectData.project) {
        setProjectTitle(projectData.project.title)
        if (meData.user) {
          setIsLeader(projectData.project.leaderId === meData.user.id)
          setIsTeacher(meData.user.role === 'teacher')
        }
      }
      if (membersData.members) setMembers(membersData.members)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [projectId])

  const unassignedTasks = tasks.filter((t) => t.assignments.length === 0)

  function toggleManualAssignee(taskId: string, userId: string) {
    setManualAssignments((prev) => {
      const current = prev[taskId] ?? []
      return {
        ...prev,
        [taskId]: current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId],
      }
    })
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, deadline: formDeadline || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Failed to create task')
      } else {
        setFormTitle('')
        setFormDeadline('')
        fetchData()
      }
    } catch {
      setFormError('Something went wrong.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDistribute() {
    setDistributeError('')
    setDistributeLoading(true)
    try {
      let body: object
      if (distributeMode === 'random') {
        body = { mode: 'random' }
      } else {
        // Build assignments array only for unassigned tasks that have selections
        const assignments = unassignedTasks
          .map((t) => ({ taskId: t.id, userIds: manualAssignments[t.id] ?? [] }))
          .filter((a) => a.userIds.length > 0)
        body = { mode: 'manual', assignments }
      }

      const res = await fetch(`/api/projects/${projectId}/tasks/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setDistributeError(data.error || 'Failed to distribute tasks')
      } else {
        setShowDistribute(false)
        setDistributeMode(null)
        setManualAssignments({})
        fetchData()
      }
    } catch {
      setDistributeError('Something went wrong.')
    } finally {
      setDistributeLoading(false)
    }
  }

  function openEdit(task: Task) {
    setEditTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description || '')
    setEditStatus(task.status as TaskStatus)
    setEditDeadline(task.deadline ? task.deadline.slice(0, 10) : '')
    setEditAssignees(task.assignments.map((a) => a.user.id))
    setEditError('')
  }

  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!editTask) return
    setEditError('')
    setEditLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${editTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          status: editStatus,
          deadline: editDeadline || null,
          assigneeIds: editAssignees,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Failed to update task')
      } else {
        setEditTask(null)
        fetchData()
      }
    } catch {
      setEditError('Something went wrong.')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' })
    fetchData()
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchData()
  }

  if (loading) {
    return (
      <ProjectLayout projectId={projectId} projectTitle={projectTitle}>
        <div className="flex items-center justify-center py-20 text-gray-400">Loading tasks...</div>
      </ProjectLayout>
    )
  }

  return (
    <ProjectLayout projectId={projectId} projectTitle={projectTitle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
        {isLeader && (
          <button
            onClick={() => { setShowForm(!showForm); setShowDistribute(false) }}

            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        )}
      </div>

      {/* Create task form (leader only) */}
      {showForm && isLeader && (
        <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">New Task</h2>
          <p className="text-sm text-gray-500 mb-4">Add tasks first, then distribute them to members.</p>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateTask} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Task title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input
                type="date"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={formLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {formLoading ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Done
            </button>
          </form>
        </div>
      )}

      {/* Distribute Tasks banner (leader or teacher, when unassigned tasks exist) */}
      {(isLeader || isTeacher) && unassignedTasks.length > 0 && !showDistribute && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {unassignedTasks.length} task{unassignedTasks.length > 1 ? 's' : ''} not yet assigned
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Distribute tasks to team members to get started.</p>
          </div>
          <button
            onClick={() => { setShowDistribute(true); setShowForm(false); setDistributeMode(null) }}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Distribute Tasks
          </button>
        </div>
      )}

      {/* Distribute panel */}
      {showDistribute && (isLeader || isTeacher) && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Distribute Tasks</h2>
              <p className="text-sm text-gray-500 mt-0.5">Choose how to assign the {unassignedTasks.length} unassigned tasks.</p>
            </div>
            <button onClick={() => setShowDistribute(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode selector */}
          {!distributeMode && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setDistributeMode('manual')}
                className="border-2 border-gray-200 hover:border-indigo-400 rounded-xl p-5 text-left transition-colors group"
              >
                <div className="text-2xl mb-2">🖐️</div>
                <p className="font-semibold text-gray-800 group-hover:text-indigo-700">Assign Manually</p>
                <p className="text-xs text-gray-500 mt-1">Pick who gets each task yourself.</p>
              </button>
              <button
                onClick={() => setDistributeMode('random')}
                className="border-2 border-gray-200 hover:border-indigo-400 rounded-xl p-5 text-left transition-colors group"
              >
                <div className="text-2xl mb-2">🎲</div>
                <p className="font-semibold text-gray-800 group-hover:text-indigo-700">Assign Randomly</p>
                <p className="text-xs text-gray-500 mt-1">Tasks are distributed evenly and at random.</p>
              </button>
            </div>
          )}

          {/* Manual assignment */}
          {distributeMode === 'manual' && (
            <div className="space-y-4">
              <button
                onClick={() => setDistributeMode(null)}
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                ← Back
              </button>
              {unassignedTasks.map((task) => (
                <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                    {task.deadline && (
                      <p className="text-xs text-gray-400">Due {formatDate(task.deadline)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleManualAssignee(task.id, m.user.id)}
                        className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                          (manualAssignments[task.id] ?? []).includes(m.user.id)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {m.user.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Random confirmation */}
          {distributeMode === 'random' && (
            <div className="space-y-4">
              <button
                onClick={() => setDistributeMode(null)}
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                ← Back
              </button>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>{unassignedTasks.length} task{unassignedTasks.length > 1 ? 's' : ''} will be randomly distributed across {members.length} member{members.length > 1 ? 's' : ''}.</p>
                <p className="mt-1 text-gray-400">Tasks are shuffled and assigned round-robin so the load is balanced.</p>
              </div>
            </div>
          )}

          {distributeError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {distributeError}
            </div>
          )}

          {distributeMode && (
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleDistribute}
                disabled={distributeLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
              >
                {distributeLoading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
              <button
                onClick={() => setShowDistribute(false)}
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="bg-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-700">{col.label}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${columnColors[col.key]}`}>
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`bg-white rounded-lg p-4 shadow-sm border ${
                      isOverdue(task.deadline) && task.status !== 'DONE'
                        ? 'border-red-200'
                        : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</p>
                      {(isLeader || isTeacher) && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEdit(task)}
                            className="text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {isLeader && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                    )}

                    {task.assignments.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {task.assignments.map((a) => (
                          <span
                            key={a.user.id}
                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full"
                          >
                            {a.user.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-500 mt-2 font-medium">Unassigned</p>
                    )}

                    {task.deadline && (
                      <p
                        className={`text-xs mt-2 font-medium ${
                          isOverdue(task.deadline) && task.status !== 'DONE'
                            ? 'text-red-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {isOverdue(task.deadline) && task.status !== 'DONE' ? 'Overdue: ' : 'Due: '}
                        {formatDate(task.deadline)}
                      </p>
                    )}

                    {/* Status change (everyone can update status) */}
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                        <button
                          key={c.key}
                          onClick={() => handleStatusChange(task.id, c.key)}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="text-center py-6 text-sm text-gray-400">No tasks</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Task Modal (leader only) */}
      {editTask && (isLeader || isTeacher) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Edit Task</h2>
            {editError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                {editError}
              </div>
            )}
            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setEditAssignees((prev) =>
                          prev.includes(m.user.id)
                            ? prev.filter((id) => id !== m.user.id)
                            : [...prev, m.user.id]
                        )
                      }
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        editAssignees.includes(m.user.id)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {m.user.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditTask(null)}
                  className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProjectLayout>
  )
}
