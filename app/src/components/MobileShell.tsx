import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, Bell, BookOpen, CalendarDays, ClipboardCheck, GraduationCap, Home, Menu, PenSquare, ReceiptText, RefreshCw, School, UsersRound } from 'lucide-react'
import { NotificationCentre } from './NotificationCentre'
import { CustomSelect } from './CustomSelect'
import './MobileShell.css'
import { useTenantConfiguration } from '../tenant'
import { portalApi } from '../api/portalApi'

export type AppRole = 'parent' | 'student' | 'teacher' | 'staff'

export interface SwipeContextValue {
  dragOffset: number
  isDragging: boolean
}

export const SwipeContext = createContext<SwipeContextValue>({
  dragOffset: 0,
  isDragging: false,
})

export const useSwipe = () => useContext(SwipeContext)

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

export function MobileShell({ activeTab, onTabChange, userRole, allowedRoles, onRoleChange, userName: _userName, environment = 'staging', children }: {
  activeTab: string; onTabChange: (tab: string) => void; userRole: AppRole; allowedRoles: AppRole[]; onRoleChange?: (role: AppRole) => void; userName: string; environment?: 'staging' | 'production'; children: ReactNode
}) {
  const tenant = useTenantConfiguration()
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchUnread = () => {
      portalApi.getNotifications()
        .then((res) => setUnreadCount(res.meta?.unread_count ?? 0))
        .catch(() => {})
    }
    fetchUnread()
    window.addEventListener('app-refresh', fetchUnread)
    return () => window.removeEventListener('app-refresh', fetchUnread)
  }, [])
  const featureByTab: Record<string, string> = { home: 'community', create: 'community', review: 'community', attendance: 'attendance', finance: 'parent_finance', academics: 'assessments', quiz: 'formal_quiz', schedule: 'schedule' }
  const navigation = navByRole[userRole].filter((item) => !featureByTab[item.id] || tenant.features[featureByTab[item.id]] !== false)
  const lastPrimaryTabRef = useRef(navigation[0]?.id ?? 'home')
  const isPrimaryTab = navigation.some((item) => item.id === activeTab)
  if (isPrimaryTab) lastPrimaryTabRef.current = activeTab
  if (!navigation.some((item) => item.id === lastPrimaryTabRef.current)) lastPrimaryTabRef.current = navigation[0]?.id ?? 'home'
  const visualActiveTab = isPrimaryTab ? activeTab : lastPrimaryTabRef.current
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const mainRef = useRef<HTMLElement>(null)

  // Scroll to top whenever the active tab changes
  const handleTabChange = (tab: string) => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' })
    } catch { /* jsdom / test env may not support scroll */ }
    onTabChange(tab)
  }

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [pullStatus, setPullStatus] = useState<'pull' | 'release' | 'refreshing'>('pull')

  const handleMainTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
    setIsDragging(true)
  }

  const handleMainTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y
    const isAtTop = window.scrollY <= 5
    if (isAtTop && deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && !isRefreshing) {
      const distance = Math.min(85, deltaY * 0.45)
      setPullDistance(distance)
      if (distance >= 55) {
        setPullStatus('release')
      } else {
        setPullStatus('pull')
      }
    } else if (Math.abs(deltaX) > Math.abs(deltaY) * 1.1 && pullDistance === 0) {
      const currentIndex = navigation.findIndex((item) => item.id === visualActiveTab)
      if ((currentIndex === 0 && deltaX > 0) || (currentIndex === navigation.length - 1 && deltaX < 0)) {
        setDragOffset(deltaX * 0.25)
      } else {
        setDragOffset(deltaX)
      }
    }
  }

  const handleMainTouchEnd = () => {
    if (!touchStart) return
    setIsDragging(false)

    if (pullDistance >= 55 && !isRefreshing) {
      setIsRefreshing(true)
      setPullStatus('refreshing')
      setPullDistance(60)

      // Hold for exactly 1 second then trigger app-refresh event as requested
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('app-refresh'))
        setTimeout(() => {
          setIsRefreshing(false)
          setPullDistance(0)
          setPullStatus('pull')
        }, 300)
      }, 1000)
    } else if (!isRefreshing) {
      setPullDistance(0)
      setPullStatus('pull')
    }

    const currentIndex = navigation.findIndex((item) => item.id === visualActiveTab)

    if (currentIndex !== -1 && pullDistance === 0) {
      if (dragOffset < -70 && currentIndex < navigation.length - 1) {
        onTabChange(navigation[currentIndex + 1].id)
      } else if (dragOffset > 70 && currentIndex > 0) {
        onTabChange(navigation[currentIndex - 1].id)
      }
    }

    setDragOffset(0)
    setTouchStart(null)
  }

  return (
    <SwipeContext.Provider value={{ dragOffset, isDragging }}>
      <div className="mis-app-shell">
        <header className="mis-app-header">
          <div className="mis-app-brand"><img src={tenant.branding.logo_url ?? '/logo.jpeg'} alt={tenant.branding.organization_short_name} /><span className="mis-app-context"><strong>{tenant.branding.app_title}</strong><small>{environment === 'production' ? tenant.branding.organization_name : 'Preview environment'}</small></span></div>
          <div className="mis-app-tools">
            {allowedRoles.length > 1 && onRoleChange && (
              <div className="role-switch">
                <CustomSelect
                  ariaLabel="Active role"
                  value={userRole}
                  onChange={(val) => onRoleChange(val as AppRole)}
                  options={allowedRoles.map((role) => ({
                    value: role,
                    label: role === 'staff' ? 'Staff' : role[0].toUpperCase() + role.slice(1),
                  }))}
                  size="compact"
                />
              </div>
            )}
            <button type="button" className="header-action" onClick={() => setShowNotifications(true)} aria-label="Notifications"><Bell />{unreadCount > 0 && <span>{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
          </div>
        </header>

        <div
          className="pull-to-refresh-indicator"
          style={{
            transform: `translate(-50%, ${pullDistance}px)`,
            opacity: pullDistance > 0 || isRefreshing ? Math.min(1, Math.max(0, pullDistance / 35)) : 0,
            transition: isDragging ? 'none' : 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease',
          }}
        >
          <div className="pull-to-refresh-badge">
            <span className={`pull-to-refresh-icon ${isRefreshing ? 'spinning' : ''}`}>
              {isRefreshing ? (
                <RefreshCw size={16} />
              ) : (
                <ArrowDown
                  size={16}
                  style={{
                    transform: pullStatus === 'release' ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              )}
            </span>
            <span>
              {pullStatus === 'refreshing'
                ? 'Refreshing page…'
                : pullStatus === 'release'
                ? 'Release to refresh'
                : 'Pull down to refresh'}
            </span>
          </div>
        </div>

        <div className="mis-app-main-wrapper">
          <main
            ref={mainRef}
            className="mis-app-main"
            onTouchStart={handleMainTouchStart}
            onTouchMove={handleMainTouchMove}
            onTouchEnd={handleMainTouchEnd}
          >
            {children}
          </main>
        </div>
        <nav className="mis-bottom-nav" aria-label="Mobile Navigation">{navigation.map((item) => {
          const active = visualActiveTab === item.id
          return <button key={item.id} type="button" className={`glass-nav-item ${active ? 'active' : ''}`} aria-label={item.label} aria-current={active ? 'page' : undefined} onClick={() => handleTabChange(item.id)}><span className="glass-nav-icon">{item.icon}</span><span className={active ? 'glass-nav-label' : 'sr-only'}>{item.label}</span></button>
        })}</nav>
        {showNotifications && (
          <NotificationCentre
            onClose={() => setShowNotifications(false)}
            onUnreadCountChange={setUnreadCount}
            onNavigate={(tab) => handleTabChange(tab)}
          />
        )}
      </div>
    </SwipeContext.Provider>
  )
}
