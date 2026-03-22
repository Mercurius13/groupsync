'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProjectLayout from '@/components/ProjectLayout'
import { formatDate } from '@/lib/utils'

interface ReportEntry {
  user: { id: string; name: string; email: string }
  role: string
  joinedAt: string
  tasksAssigned: number
  tasksCompleted: number
  completionRate: number
  activityCount: number
}

interface Project {
  id: string
  title: string
}

export default function ReportPage() {
  const params = useParams()
  const projectId = params.id as string

  const [report, setReport] = useState<ReportEntry[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectTitle, setProjectTitle] = useState('')

  useEffect(() => {
    async function fetchReport() {
      try {
        const [reportRes, projectRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/report`),
          fetch(`/api/projects/${projectId}`),
        ])
        const [reportData, projectData] = await Promise.all([reportRes.json(), projectRes.json()])
        if (reportData.report) setReport(reportData.report)
        if (reportData.project) setProject(reportData.project)
        if (projectData.project) setProjectTitle(projectData.project.title)
      } catch (error) {
        console.error('Failed to fetch report:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [projectId])

  function handlePrint() {
    window.print()
  }

  const totalTasks = report.reduce((sum, r) => sum + r.tasksAssigned, 0)
  const totalCompleted = report.reduce((sum, r) => sum + r.tasksCompleted, 0)

  return (
    <ProjectLayout projectId={projectId} projectTitle={projectTitle}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contribution Report</h1>
            {project && (
              <p className="text-sm text-gray-500 mt-1">
                {project.title} — Generated {formatDate(new Date())}
              </p>
            )}
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm print:hidden"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Export
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Generating report...</div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-6 print:grid-cols-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-gray-900">{report.length}</p>
                <p className="text-sm text-gray-500 mt-1">Total Members</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalTasks}</p>
                <p className="text-sm text-gray-500 mt-1">Tasks Assigned</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-2xl font-bold text-indigo-600">{totalCompleted}</p>
                <p className="text-sm text-gray-500 mt-1">Tasks Completed</p>
              </div>
            </div>

            {/* Report table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Assigned
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Activities
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.map((entry) => (
                    <tr key={entry.user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                            {entry.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{entry.user.name}</p>
                            <p className="text-xs text-gray-400">{entry.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          entry.role === 'leader'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {entry.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-900">{entry.tasksAssigned}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-sm font-semibold text-green-600">{entry.tasksCompleted}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {entry.completionRate}%
                          </span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${entry.completionRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-900">{entry.activityCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {report.length === 0 && (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  No members found
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-sm text-amber-700">
                <span className="font-semibold">Note:</span> Completion rate is calculated only for tasks assigned to that member.
              </p>
            </div>
          </>
        )}
      </div>
    </ProjectLayout>
  )
}
