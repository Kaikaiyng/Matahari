import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  CheckCheck,
  CreditCard,
  GraduationCap,
  CalendarCheck,
  ShieldAlert,
  Bell,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { portalApi, type PortalNotification } from '../api/portalApi'
import '../features/community-safety/CommunitySafety.css'
import './NotificationCentre.css'

export interface NotificationCentreProps {
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
  onNavigate?: (tab: string) => void
}

type NotificationCategory = 'all' | 'unread' | 'finance' | 'academic' | 'attendance' | 'general'

export const NotificationCentre: React.FC<NotificationCentreProps> = ({
  onClose,
  onUnreadCountChange,
  onNavigate,
}) => {
  const [isExiting, setIsExiting] = useState(false)
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [activeFilter, setActiveFilter] = useState<NotificationCategory>('all')

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const handleBack = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      onClose()
      setIsExiting(false)
    }, 200)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (!touchStart) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y

    if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      setDragOffset(deltaX)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (!touchStart) return
    setIsDragging(false)

    if (dragOffset > 80) {
      handleBack()
    }

    setDragOffset(0)
    setTouchStart(null)
  }

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await portalApi.getNotifications()
      setNotifications(res.data ?? [])
      onUnreadCountChange?.(res.meta?.unread_count ?? 0)
    } catch {
      setError('Unable to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [onUnreadCountChange])

  useEffect(() => {
    void load()
  }, [load])

  const handleMarkRead = async (id: number) => {
    try {
      await portalApi.markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
      const newUnread = notifications.filter((n) => n.id !== id && !n.read_at).length
      onUnreadCountChange?.(newUnread)
    } catch {
      // silent
    }
  }

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true)
      await portalApi.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
      onUnreadCountChange?.(0)
    } catch {
      setError('Failed to mark all as read.')
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.read_at
      if (activeFilter === 'finance') return n.type === 'finance' || n.type === 'payment_reminder'
      if (activeFilter === 'academic') return n.type === 'academic' || n.type === 'quiz' || n.type === 'assessment'
      if (activeFilter === 'attendance') return n.type === 'attendance'
      if (activeFilter === 'general') return n.type === 'general' || n.type === 'system' || n.type === 'community_moderation'
      return true
    })
  }, [notifications, activeFilter])

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 172800) return 'Yesterday'
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const getNotificationConfig = (type: string) => {
    switch (type) {
      case 'finance':
      case 'payment_reminder':
        return {
          icon: <CreditCard size={18} />,
          badgeClass: 'nc-badge-finance',
          label: 'Finance',
          targetTab: 'finance',
        }
      case 'academic':
      case 'quiz':
      case 'assessment':
        return {
          icon: <GraduationCap size={18} />,
          badgeClass: 'nc-badge-academic',
          label: 'Academics',
          targetTab: 'academics',
        }
      case 'attendance':
        return {
          icon: <CalendarCheck size={18} />,
          badgeClass: 'nc-badge-attendance',
          label: 'Attendance',
          targetTab: 'attendance',
        }
      case 'community_moderation':
      case 'safety':
        return {
          icon: <ShieldAlert size={18} />,
          badgeClass: 'nc-badge-safety',
          label: 'Safety',
          targetTab: 'home',
        }
      default:
        return {
          icon: <Bell size={18} />,
          badgeClass: 'nc-badge-general',
          label: 'General',
          targetTab: undefined,
        }
    }
  }

  const handleActionClick = (n: PortalNotification) => {
    if (!n.read_at) {
      void handleMarkRead(n.id)
    }
    const config = getNotificationConfig(n.type)
    if (config.targetTab && onNavigate) {
      handleBack()
      onNavigate(config.targetTab)
    }
  }

  return createPortal(
    <div
      className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="region"
      aria-label="Notification Centre Subpage"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#f6f3ee',
        overflowY: 'auto',
        transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
        opacity: dragOffset > 0 ? Math.max(0.2, 1 - dragOffset / 400) : undefined,
        transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
        willChange: 'transform, opacity',
      }}
    >
      <div className="subpage-container">
        <header className="subpage-header">
          <button
            type="button"
            className="subpage-back-btn"
            onClick={handleBack}
            aria-label="Close notifications"
          >
            <ChevronLeft size={20} />
          </button>

          <h1 className="subpage-nav-title">
            Notifications
            {unreadCount > 0 && <span className="nc-header-count">{unreadCount}</span>}
          </h1>

          {unreadCount > 0 ? (
            <button
              type="button"
              className="nc-mark-all-btn"
              onClick={() => void handleMarkAllRead()}
              disabled={markingAll}
            >
              <CheckCheck size={14} />
              <span>{markingAll ? 'Marking…' : 'Mark read'}</span>
            </button>
          ) : (
            <div style={{ width: '38px', flexShrink: 0 }} />
          )}
        </header>

        {/* Filter Pills */}
        <div className="nc-filter-bar">
          <button
            type="button"
            className={`nc-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All <span className="nc-chip-count">{notifications.length}</span>
          </button>
          <button
            type="button"
            className={`nc-filter-chip ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            Unread {unreadCount > 0 && <span className="nc-chip-badge">{unreadCount}</span>}
          </button>
          <button
            type="button"
            className={`nc-filter-chip ${activeFilter === 'finance' ? 'active' : ''}`}
            onClick={() => setActiveFilter('finance')}
          >
            Finance
          </button>
          <button
            type="button"
            className={`nc-filter-chip ${activeFilter === 'academic' ? 'active' : ''}`}
            onClick={() => setActiveFilter('academic')}
          >
            Academics
          </button>
          <button
            type="button"
            className={`nc-filter-chip ${activeFilter === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveFilter('attendance')}
          >
            Attendance
          </button>
          <button
            type="button"
            className={`nc-filter-chip ${activeFilter === 'general' ? 'active' : ''}`}
            onClick={() => setActiveFilter('general')}
          >
            General
          </button>
        </div>

        <section className="subpage-content-group">
          {loading && (
            <div className="nc-state">
              <div className="nc-spinner" />
              <p>Loading notifications…</p>
            </div>
          )}

          {!loading && error && (
            <div className="nc-state nc-error">
              <span>⚠️</span>
              <p>{error}</p>
              <button onClick={() => void load()} className="nc-danger-retry-btn">Retry</button>
            </div>
          )}

          {!loading && !error && filteredNotifications.length === 0 && (
            <div className="nc-empty-card">
              <div className="nc-empty-glow">
                {activeFilter === 'unread' ? <Sparkles size={32} /> : <Bell size={32} />}
              </div>
              <h2>{activeFilter === 'unread' ? 'All caught up!' : 'No notifications'}</h2>
              <p>
                {activeFilter === 'unread'
                  ? "You've read all your recent notifications."
                  : 'Important school announcements, fee updates, and academic progress will appear here.'}
              </p>
            </div>
          )}

          {!loading && !error && filteredNotifications.length > 0 && (
            <div className="nc-card-list">
              {filteredNotifications.map((n) => {
                const config = getNotificationConfig(n.type)
                const isUnread = !n.read_at
                return (
                  <article
                    key={n.id}
                    className={`nc-notification-card ${isUnread ? 'is-unread' : ''}`}
                    onClick={() => handleActionClick(n)}
                  >
                    <div className="nc-card-header">
                      <span className={`nc-type-badge ${config.badgeClass}`}>
                        {config.icon}
                        <span>{config.label}</span>
                      </span>
                      <time className="nc-time-tag">{formatTime(n.created_at)}</time>
                      {isUnread && <span className="nc-unread-indicator" title="Unread" />}
                    </div>

                    <h3 className="nc-card-title">{n.title}</h3>
                    <p className="nc-card-body">{n.body}</p>

                    {config.targetTab && (
                      <footer className="nc-card-footer">
                        <span className="nc-action-link">
                          <span>View in {config.label}</span>
                          <ArrowUpRight size={14} />
                        </span>
                      </footer>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body
  )
}
