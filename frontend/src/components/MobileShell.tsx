import React, { useState } from 'react'
import './MobileShell.css'
import { NotificationCentre } from './NotificationCentre'
import {
  IconlyHome,
  IconlyMyKids,
  IconlyFees,
  IconlyProfile,
  IconlyOverview,
  IconlyGraduationCap,
  IconlyCalendar,
  IconlyBell,
} from './icons/IconlyIcons'

export interface MobileShellProps {
  activeTab: string
  onTabChange: (tab: string) => void
  userRole: 'parent' | 'student'
  allowedRoles: Array<'parent' | 'student'>
  onRoleChange?: (role: 'parent' | 'student') => void
  onLogout: () => void
  userName: string
  environment?: 'staging' | 'production'
  children: React.ReactNode
}

export const MobileShell: React.FC<MobileShellProps> = ({
  activeTab,
  onTabChange,
  userRole,
  allowedRoles,
  onRoleChange,
  onLogout,
  userName,
  environment = 'staging',
  children,
}) => {
  const avatarLetter = userName ? userName.charAt(0).toUpperCase() : 'U'
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const parentNav = [
    { id: 'home', label: 'Home', icon: <IconlyHome size={22} /> },
    { id: 'children', label: 'My Kids', icon: <IconlyMyKids size={22} /> },
    { id: 'finance', label: 'Finance', icon: <IconlyFees size={22} /> },
    { id: 'profile', label: 'Profile', icon: <IconlyProfile size={22} /> },
  ]

  const studentNav = [
    { id: 'home', label: 'Overview', icon: <IconlyOverview size={22} /> },
    { id: 'academics', label: 'Academics', icon: <IconlyGraduationCap size={22} /> },
    { id: 'schedule', label: 'Schedule', icon: <IconlyCalendar size={22} /> },
    { id: 'profile', label: 'Profile', icon: <IconlyProfile size={22} /> },
  ]

  const navItems = userRole === 'student' ? studentNav : parentNav

  return (
    <div className="mobile-app-root">
      <header className="mobile-header">
        <div className="mobile-brand">
          <img src="/logo.jpeg" alt="MIS Logo" className="mobile-brand-logo" />
          <span className={`mobile-env-badge ${environment}`}>{environment}</span>
        </div>
        <div className="mobile-user-profile">
          {onRoleChange && allowedRoles.length > 1 && (
            <select
              value={userRole}
              onChange={(e) => onRoleChange(e.target.value as 'parent' | 'student')}
              style={{
                fontSize: '11px',
                padding: '3px 6px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
              }}
            >
              {allowedRoles.map((role) => (
                <option key={role} value={role}>{role === 'parent' ? 'Parent' : 'Student'}</option>
              ))}
            </select>
          )}

          {/* Bell icon with unread badge */}
          <button
            className="mobile-bell-btn"
            onClick={() => setShowNotifications(true)}
            aria-label="Notifications"
          >
            <IconlyBell size={20} />
            {unreadCount > 0 && (
              <span className="mobile-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          <div className="mobile-avatar" title={userName}>
            {avatarLetter}
          </div>
          <button type="button" className="mobile-logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="mobile-main-content">{children}</main>

      <nav className="mobile-nav-bar" aria-label="Mobile Navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {showNotifications && (
        <NotificationCentre
          onClose={() => setShowNotifications(false)}
          onUnreadCountChange={setUnreadCount}
        />
      )}
    </div>
  )
}
