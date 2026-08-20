import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Clock,
  CreditCard,
  GraduationCap,
  ShieldAlert,
  X,
} from 'lucide-react'
import { apiRequest } from '../api'

export interface AdminNotification {
  id: number
  type: string
  title: string
  body: string
  category: 'finance' | 'academic' | 'system' | 'general'
  created_at: string
  read_at: string | null
  action_url?: string
}

const DEFAULT_ADMIN_NOTIFICATIONS: AdminNotification[] = [
  {
    id: 101,
    type: 'payment_reminder',
    title: 'Payment Reminder Sent',
    body: 'In-app payment reminder successfully sent to parent Rachel Wong for Alyssa Tan (MB1).',
    category: 'finance',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read_at: null,
  },
  {
    id: 102,
    type: 'student_enrollment',
    title: 'New Student Enrolled',
    body: 'Amina Lee was registered to Class MA1 in Primary level group.',
    category: 'academic',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read_at: null,
  },
  {
    id: 103,
    type: 'fee_agreement',
    title: 'Fee Agreement Superseded',
    body: 'Fee agreement version 2 created and active for Daniel Lim (2026 Academic Year).',
    category: 'finance',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 104,
    type: 'schedule_published',
    title: 'Class Timetable Published',
    body: 'Weekly timetable for Secondary MP1 has been published to Parent and Student portals.',
    category: 'academic',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
]

interface AdminNotificationPopoverProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

export const AdminNotificationPopover: React.FC<AdminNotificationPopoverProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>(DEFAULT_ADMIN_NOTIFICATIONS)
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'finance' | 'academic'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Fetch live notifications if available
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    async function fetchNotifications() {
      setIsLoading(true)
      try {
        const res = await apiRequest<{ data: AdminNotification[]; meta?: { unread_count: number } }>(
          '/notifications',
        )
        if (!cancelled && res?.data && res.data.length > 0) {
          setNotifications(res.data)
        }
      } catch {
        // Fallback to demo notifications
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchNotifications()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  // Track unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read_at).length
  }, [notifications])

  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [unreadCount, onUnreadCountChange])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const markAsRead = async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    )
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' })
    } catch {
      // Soft ignore
    }
  }

  const markAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
    )
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST' })
    } catch {
      // Soft ignore
    }
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.read_at
      if (activeFilter === 'finance') return n.category === 'finance'
      if (activeFilter === 'academic') return n.category === 'academic'
      return true
    })
  }, [notifications, activeFilter])

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      const diffMs = Date.now() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      return `${diffDays}d ago`
    } catch {
      return ''
    }
  }

  const getCategoryIcon = (category: string, type: string) => {
    if (category === 'finance' || type.includes('payment') || type.includes('fee')) {
      return <CreditCard size={15} />
    }
    if (category === 'academic' || type.includes('student') || type.includes('schedule')) {
      return <GraduationCap size={15} />
    }
    if (type.includes('alert') || type.includes('warning')) {
      return <ShieldAlert size={15} />
    }
    return <Bell size={15} />
  }

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="admin-notification-popover"
      role="dialog"
      aria-label="Notification Center"
      aria-modal="true"
    >
      {/* Header */}
      <div className="admin-notif-header">
        <div className="admin-notif-title-row">
          <div className="admin-notif-title-left">
            <Bell size={18} className="admin-notif-title-icon" />
            <h3 className="admin-notif-title">Notifications</h3>
            {unreadCount > 0 && (
              <span className="admin-notif-badge">{unreadCount} New</span>
            )}
          </div>
          <button
            type="button"
            className="admin-notif-close-btn"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="admin-notif-toolbar">
          <div className="admin-notif-filters">
            <button
              type="button"
              className={`admin-notif-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`admin-notif-filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              className={`admin-notif-filter-pill ${activeFilter === 'finance' ? 'active' : ''}`}
              onClick={() => setActiveFilter('finance')}
            >
              Finance
            </button>
            <button
              type="button"
              className={`admin-notif-filter-pill ${activeFilter === 'academic' ? 'active' : ''}`}
              onClick={() => setActiveFilter('academic')}
            >
              Academic
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              className="admin-notif-mark-all"
              onClick={markAllAsRead}
              title="Mark all as read"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Body List */}
      <div className="admin-notif-body">
        {isLoading ? (
          <div className="admin-notif-empty">
            <Clock size={24} className="admin-notif-empty-icon spin" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="admin-notif-empty">
            <AlertCircle size={28} className="admin-notif-empty-icon" />
            <h4>No notifications</h4>
            <p>
              {activeFilter === 'unread'
                ? "You're all caught up! No unread alerts."
                : 'No alerts in this category.'}
            </p>
          </div>
        ) : (
          <div className="admin-notif-list">
            {filteredNotifications.map((item) => {
              const isUnread = !item.read_at

              return (
                <div
                  key={item.id}
                  className={`admin-notif-card ${isUnread ? 'is-unread' : ''}`}
                  onClick={() => {
                    if (isUnread) markAsRead(item.id)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (isUnread) markAsRead(item.id)
                    }
                  }}
                >
                  <div className="admin-notif-icon-box">
                    {getCategoryIcon(item.category, item.type)}
                  </div>

                  <div className="admin-notif-content">
                    <div className="admin-notif-card-header">
                      <h4 className="admin-notif-card-title">{item.title}</h4>
                      <span className="admin-notif-time">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    <p className="admin-notif-card-body">{item.body}</p>
                  </div>

                  {isUnread && (
                    <span
                      className="admin-notif-unread-dot"
                      title="Unread notification"
                      aria-label="Unread"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
