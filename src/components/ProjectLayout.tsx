'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

interface ProjectLayoutProps {
  children: React.ReactNode
  projectId: string
  projectTitle?: string
}

export default function ProjectLayout({ children, projectId, projectTitle }: ProjectLayoutProps) {
  const pathname = usePathname()

  const tabs = [
    { href: `/projects/${projectId}`, label: 'Overview' },
    { href: `/projects/${projectId}/tasks`, label: 'Tasks' },
    { href: `/projects/${projectId}/activity`, label: 'Activity' },
    { href: `/projects/${projectId}/chat`, label: 'Chat' },
    { href: `/projects/${projectId}/report`, label: 'Report' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Project header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{projectTitle || 'Project'}</span>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 mt-3">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  )
}
