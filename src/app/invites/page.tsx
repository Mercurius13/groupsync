'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Invite {
  id: string
  createdAt: string
  expiresAt: string
  project: {
    id: string
    title: string
    description: string | null
    leader: { name: string }
    _count: { members: number }
  }
}

export default function InvitesPage() {
  const router = useRouter()
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  async function fetchInvites() {
    try {
      const res = await fetch('/api/invites')
      const data = await res.json()
      if (data.invites) setInvites(data.invites)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvites() }, [])

  async function handleAccept(invite: Invite) {
    setActing(invite.id)
    try {
      const res = await fetch(`/api/invites/${invite.id}/accept`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        router.push(`/projects/${data.projectId}`)
      } else {
        alert(data.error || 'Failed to accept invite')
        fetchInvites()
      }
    } finally {
      setActing(null)
    }
  }

  async function handleDecline(inviteId: string) {
    if (!confirm('Decline this invitation?')) return
    setActing(inviteId)
    try {
      await fetch(`/api/invites/${inviteId}/decline`, { method: 'POST' })
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Invitations</h1>
          <p className="text-sm text-gray-500 mb-8">Projects you&apos;ve been invited to join.</p>

          {loading ? (
            <div className="text-center py-20 text-gray-400">Loading...</div>
          ) : invites.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-600 font-medium">No pending invitations</p>
              <p className="text-sm text-gray-400 mt-1">When someone invites you to a project, it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => (
                <div key={invite.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900">{invite.project.title}</h2>
                      {invite.project.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{invite.project.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>Led by <strong className="text-gray-600">{invite.project.leader.name}</strong></span>
                        <span>·</span>
                        <span>{invite.project._count.members} member{invite.project._count.members !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDecline(invite.id)}
                        disabled={acting === invite.id}
                        className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(invite)}
                        disabled={acting === invite.id}
                        className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {acting === invite.id ? 'Joining...' : 'Accept'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
