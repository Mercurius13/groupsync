'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import ProjectLayout from '@/components/ProjectLayout'
import { formatDateTime } from '@/lib/utils'

interface Message {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string; email: string }
}

interface CurrentUser {
  id: string
  name: string
  email: string
}

export default function ChatPage() {
  const params = useParams()
  const projectId = params.id as string

  const [messages, setMessages] = useState<Message[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [projectTitle, setProjectTitle] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const [projectRes, meRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch('/api/auth/me'),
        ])
        const [projectData, meData] = await Promise.all([projectRes.json(), meRes.json()])
        if (projectData.project) setProjectTitle(projectData.project.title)
        if (meData.user) setCurrentUser(meData.user)
      } catch (error) {
      }
      await fetchMessages()
      setLoading(false)
    }

    init()

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchMessages, 5000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [projectId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() }),
      })
      if (res.ok) {
        setNewMessage('')
        await fetchMessages()
      }
    } catch (error) {
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as unknown as React.FormEvent)
    }
  }

  return (
    <ProjectLayout projectId={projectId} projectTitle={projectTitle}>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-200px)]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Team Chat</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            Auto-refreshes every 5s
          </span>
        </div>

        {/* Messages area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-y-auto p-5 mb-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm mt-1">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isOwn = currentUser?.id === msg.user.id
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                        isOwn ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {msg.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-semibold text-gray-700">{msg.user.name}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isOwn
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <form onSubmit={handleSend} className="flex gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
            >
              {sending ? '...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </ProjectLayout>
  )
}
