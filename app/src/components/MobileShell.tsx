import { useState, type ReactNode } from 'react'
import { Bell, BookOpen, CalendarDays, CircleUserRound, ClipboardCheck, GraduationCap, Home, LogOut, Menu, PenSquare, ReceiptText, School, UsersRound } from 'lucide-react'
import { NotificationCentre } from './NotificationCentre'
import './MobileShell.css'

export type AppRole = 'parent' | 'student' | 'teacher' | 'staff'

type NavItem = { id: string; label: string; icon: ReactNode }

const navByRole: Record<AppRole, NavItem[]> = {
  parent: [
    { id: 'home', label: 'Home', icon: <Home /> }, { id: 'children', label: 'Children', icon: <UsersRound /> },
    { id: 'academics', label: 'Academics', icon: <GraduationCap /> }, { id: 'finance', label: 'Finance', icon: <ReceiptText /> }, { id: 'more', label: 'More', icon: <Menu /> },
  ],
  student: [
    { id: 'home', label: 'Home', icon: <Home /> }, { id: 'learn', label: 'Learn', icon: <BookOpen /> },
    { id: 'quiz', label: 'Quiz', icon: <ClipboardCheck /> }, { id: 'schedule', label: 'Schedule', icon: <CalendarDays /> }, { id: 'more', label: 'More', icon: <Menu /> },
  ],
  teacher: [
    { id: 'home', label: 'Home', icon: <Home /> }, { id: 'classes', label: 'Classes', icon: <School /> },
    { id: 'create', label: 'Create', icon: <PenSquare /> }, { id: 'attendance', label: 'Attendance', icon: <ClipboardCheck /> }, { id: 'more', label: 'More', icon: <Menu /> },
  ],
  staff: [
    { id: 'home', label: 'Home', icon: <Home /> }, { id: 'classes', label: 'School', icon: <School /> },
    { id: 'create', label: 'Create', icon: <PenSquare /> }, { id: 'review', label: 'Review', icon: <ClipboardCheck /> }, { id: 'more', label: 'More', icon: <Menu /> },
  ],
}

export function MobileShell({ activeTab, onTabChange, userRole, allowedRoles, onRoleChange, onLogout, userName, environment = 'staging', children }: {
  activeTab: string; onTabChange: (tab: string) => void; userRole: AppRole; allowedRoles: AppRole[]; onRoleChange?: (role: AppRole) => void; onLogout: () => void; userName: string; environment?: 'staging' | 'production'; children: ReactNode
}) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  return (
    <div className="mis-app-shell">
      <header className="mis-app-header">
        <div className="mis-app-brand"><img src="/logo.jpeg" alt="MIS" /><span><strong>Matahari International School</strong><small>{environment === 'production' ? 'School community' : 'Preview environment'}</small></span></div>
        <div className="mis-app-tools">
          {allowedRoles.length > 1 && onRoleChange && <label className="role-switch"><span className="sr-only">Active role</span><select value={userRole} onChange={(event) => onRoleChange(event.target.value as AppRole)}>{allowedRoles.map((role) => <option key={role} value={role}>{role === 'staff' ? 'Staff' : role[0].toUpperCase() + role.slice(1)}</option>)}</select></label>}
          <button type="button" className="header-action" onClick={() => setShowNotifications(true)} aria-label="Notifications"><Bell />{unreadCount > 0 && <span>{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
          <button type="button" className="header-avatar" onClick={() => onTabChange('more')} aria-label="Open profile"><CircleUserRound /><span>{userName.split(' ')[0]}</span></button>
          <button type="button" className="header-action" onClick={onLogout} aria-label="Logout"><LogOut /></button>
        </div>
      </header>
      <main className="mis-app-main">{children}</main>
      <nav className="mis-bottom-nav" aria-label="Mobile Navigation">{navByRole[userRole].map((item) => <button key={item.id} type="button" className={activeTab === item.id ? 'active' : ''} onClick={() => onTabChange(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
      {showNotifications && <NotificationCentre onClose={() => setShowNotifications(false)} onUnreadCountChange={setUnreadCount} />}
    </div>
  )
}
