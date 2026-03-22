export function formatDate(date: string | Date): string {
  // Parse date-only strings (YYYY-MM-DD) directly to avoid UTC-to-local timezone shift
  const str = typeof date === 'string' ? date : date.toISOString()
  const dateOnly = str.slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'TODO':
      return 'bg-gray-100 text-gray-700'
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-700'
    case 'DONE':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'TODO':
      return 'To Do'
    case 'IN_PROGRESS':
      return 'In Progress'
    case 'DONE':
      return 'Done'
    default:
      return status
  }
}

export function getActionIcon(actionType: string): string {
  switch (actionType) {
    case 'TASK_CREATED':
      return '✅'
    case 'TASK_UPDATED':
      return '✏️'
    case 'TASK_COMPLETED':
      return '🎉'
    case 'TASK_ASSIGNED':
      return '👤'
    case 'MESSAGE_SENT':
      return '💬'
    case 'PROJECT_CREATED':
      return '🚀'
    case 'MEMBER_ADDED':
      return '➕'
    default:
      return '📌'
  }
}

export function isOverdue(deadline: string | Date | null | undefined): boolean {
  if (!deadline) return false
  const str = typeof deadline === 'string' ? deadline : deadline.toISOString()
  const dateOnly = str.slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  const deadlineDate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return deadlineDate < today
}
