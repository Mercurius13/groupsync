'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProjectLayout from '@/components/ProjectLayout'
import { formatDateTime, getActionIcon } from '@/lib/utils'

interface ActivityLog {
  id: string
  actionType: string
  description: string
  createdAt: string
  taskId: string | null
  user: { id: string; name: string; email: string }
}

interface Member {
  id: string
  user: { id: string; name: string; email: string }
}

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'TASK_CREATED', label: 'Task Created' },
  { value: 'TASK_UPDATED', label: 'Task Updated' },
  { value: 'TASK_COMPLETED', label: 'Task Completed' },
  { value: 'TASK_ASSIGNED', label: 'Task Assigned' },
  { value: 'MESSAGE_SENT', label: 'Message Sent' },
  { value: 'PROJECT_CREATED', label: 'Project Created' },
  { value: 'MEMBER_ADDED', label: 'Member Added' },
]

export default function ActivityPage() {
  const params = useParams()
  const projectId = params.id as string

  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [projectTitle, setProjectTitle] = useState('')
  const [filterUserId, setFilterUserId] = useState('')
  const [filterActionType, setFilterActionType] = useState('')

  async function fetchActivity() {
    setLoading(true)
    try {
      const params_ = new URLSearchParams()
      if (filterUserId) params_.set('userId', filterUserId)
      if (filterActionType) params_.set('actionType', filterActionType)

      const [logsRes, projectRes, membersRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/activity?${params_.toString()}`),
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/members`),
      ])

      const [logsData, projectData, membersData] = await Promise.all([
        logsRes.json(),
        projectRes.json(),
        membersRes.json(),
      ])

      if (logsData.logs) setLogs(logsData.logs)
      if (projectData.project) setProjectTitle(projectData.project.title)
      if (membersData.members) setMembers(membersData.members)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivity()
  }, [projectId, filterUserId, filterActionType])

  return (
    <ProjectLayout projectId={projectId} projectTitle={projectTitle}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
          <span className="text-sm text-gray-500">{logs.length} entries</span>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Member</label>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Action</label>
              <select
                value={filterActionType}
                onChange={(e) => setFilterActionType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            {(filterUserId || filterActionType) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterUserId('')
                    setFilterActionType('')
                  }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Activity list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">Loading activity...</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <p className="text-lg">No activity found</p>
              <p className="text-sm mt-1">
                {filterUserId || filterActionType ? 'Try adjusting your filters' : 'Activity will appear here as the team works'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="text-xl flex-shrink-0 mt-0.5">{getActionIcon(log.actionType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{log.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {ACTION_TYPES.find((a) => a.value === log.actionType)?.label || log.actionType}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-semibold">
                      {log.user.name.charAt(0).toUpperCase()}
                    </div>
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
