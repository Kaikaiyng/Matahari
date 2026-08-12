import React, { useEffect, useState, useCallback } from 'react'
import { portalApi, type PortalNotification } from '../api/portalApi'
import './NotificationCentre.css'

export interface NotificationCentreProps {
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

export const NotificationCentre: React.FC<NotificationCentreProps> = ({
  onClose,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await portalApi.getNotifications()
      setNotifications(resp.data)
      onUnreadCountChange?.(resp.meta.unread_count)
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
      const resp = await portalApi.markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? resp.data : n)),
      )
      const unread = notifications.filter((n) => n.id !== id && !n.read_at).length
      onUnreadCountChange?.(unread)
    } catch {
      // silent — notification remains unread
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

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    return `${diffDays}d ago`
  }

  const typeIcon: Record<string, string> = {
    payment_reminder: '💳',
    general: '📢',
    academic: '📚',
    alert: '⚠️',
  }

  return (
    <div className="nc-overlay" onClick={onClose}>
      <div className="nc-panel" onClick={(e) => e.stopPropagation()}>
        <div className="nc-header">
          <div className="nc-title">
            Notifications
            {unreadCount > 0 && (
              <span className="nc-badge">{unreadCount}</span>
            )}
          </div>
          <div className="nc-header-actions">
            {unreadCount > 0 && (
              <button
                className="nc-mark-all-btn"
                onClick={() => void handleMarkAllRead()}
                disabled={markingAll}
              >
                {markingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
            <button className="nc-close-btn" onClick={onClose} aria-label="Close notifications">
              ✕
            </button>
          </div>
        </div>

        <div className="nc-body">
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

          {!loading && !error && notifications.length === 0 && (
            <div className="nc-state nc-empty">
              <span className="nc-empty-icon">🔔</span>
              <p>No notifications yet</p>
              <small>You'll see payment reminders and updates here.</small>
            </div>
          )}

          {!loading && !error && notifications.length > 0 && (
            <ul className="nc-list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`nc-item ${!n.read_at ? 'nc-item-unread' : ''}`}
                  onClick={() => {
                    if (!n.read_at) void handleMarkRead(n.id)
                  }}
                >
                  <div className="nc-item-icon">
                    {typeIcon[n.type] ?? '📢'}
                  </div>
                  <div className="nc-item-content">
                    <div className="nc-item-title">{n.title}</div>
                    <div className="nc-item-body">{n.body}</div>
                    <div className="nc-item-time">{formatTime(n.created_at)}</div>
                  </div>
                  {!n.read_at && <div className="nc-unread-dot" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
