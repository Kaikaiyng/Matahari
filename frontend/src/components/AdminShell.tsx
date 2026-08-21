import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronLeft, ChevronRight, Info, Menu, X } from 'lucide-react'
import { IconlyBell, IconlyLogout } from './icons/IconlyIcons'
import { BrandMark } from './BrandMark'
import { AdminNotificationPopover } from './AdminNotificationPopover'
import './AdminShell.css'

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'
const SIDEBAR_GROUPS_KEY = 'admin-sidebar-groups'
const TABLET_NAV_QUERY = '(max-width: 1180px)'

export type NavigationItem<PageKey extends string> = {
  key: PageKey
  label: string
  icon: LucideIcon
  requiredPermission?: string
  requiredAnyPermissions?: string[]
}

export type NavigationGroup<PageKey extends string> = {
  label: string
  icon: LucideIcon
  standalone?: boolean
  items: NavigationItem<PageKey>[]
}

type AdminShellProps<PageKey extends string> = {
  activePage: PageKey
  pageTitle: string
  contextText: string
  navGroups: NavigationGroup<PageKey>[]
  apiState: 'live' | 'demo' | 'loading'
  user: {
    name: string
    username: string
  }
  onSelectPage: (page: PageKey) => void
  onLogout: () => void
  children: ReactNode
}

export function AdminShell<PageKey extends string>({
  activePage,
  pageTitle,
  contextText,
  navGroups,
  apiState,
  user,
  onSelectPage,
  onLogout,
  children,
}: AdminShellProps<PageKey>) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(SIDEBAR_GROUPS_KEY) ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    window.matchMedia(TABLET_NAV_QUERY).matches,
  )
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(2)
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(false)

  const closeDrawer = useCallback((restoreFocus = true) => {
    shouldRestoreFocusRef.current = restoreFocus
    setIsOpen(false)
  }, [])

  const toggleCollapsed = () => {
    setIsCollapsed((current) => {
      const next = !current

      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // The visual state can still change when storage is unavailable.
      }

      return next
    })
  }

  const toggleGroup = (label: string) => {
    setExpandedGroups((current) => {
      const next = { ...current, [label]: !current[label] }
      try {
        window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next))
      } catch {
        // Navigation remains usable when storage is unavailable.
      }
      return next
    })
  }

  useEffect(() => {
    document.body.classList.toggle('nav-open', isOpen)

    return () => document.body.classList.remove('nav-open')
  }, [isOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia(TABLET_NAV_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsNarrowViewport(event.matches)
      if (!event.matches) {
        setIsOpen(false)
      }
    }

    setIsNarrowViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDrawer, isOpen])

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus()
      return
    }

    if (shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false
      menuRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activePage])

  const selectPage = (page: PageKey) => {
    onSelectPage(page)
    closeDrawer(false)
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || 'U'

  return (
    <div className={isCollapsed ? 'admin-shell sidebar-collapsed' : 'admin-shell'}>
      <button
        className="sidebar-backdrop"
        aria-label="Close navigation backdrop"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={() => closeDrawer()}
      />

      <aside
        className={`admin-sidebar${isOpen ? ' open' : ''}${isCollapsed ? ' collapsed' : ''}`}
        id="main-navigation"
        aria-hidden={isNarrowViewport && !isOpen ? true : undefined}
        inert={isNarrowViewport && !isOpen ? true : undefined}
      >
        <div className="admin-brand">
          <BrandMark className="admin-brand-mark" />
          <button
            ref={closeRef}
            className="icon-button drawer-close"
            aria-label="Close navigation"
            onClick={() => closeDrawer()}
          >
            <X size={19} />
          </button>
        </div>

        <button
          type="button"
          className="sidebar-collapse"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          onClick={toggleCollapsed}
        >
          {isCollapsed
            ? <ChevronRight className="sidebar-collapse-icon" size={16} />
            : <ChevronLeft className="sidebar-collapse-icon" size={16} />}
        </button>

        <nav aria-label="Main navigation">
          {navGroups.map((group) => {
            const hasActiveItem = group.items.some((item) => item.key === activePage)
            const isExpanded = hasActiveItem || expandedGroups[group.label] === true

            if (group.standalone) {
              const item = group.items[0]
              if (!item) return null
              const Icon = group.icon

              return (
                <button
                  key={group.label}
                  aria-current={item.key === activePage ? 'page' : undefined}
                  aria-label={item.label}
                  className={item.key === activePage ? 'nav-item nav-single active' : 'nav-item nav-single'}
                  onClick={() => selectPage(item.key)}
                >
                  <span className="nav-item-icon-box"><Icon size={18} /></span>
                  <span className="sidebar-label">{item.label}</span>
                </button>
              )
            }

            const GroupIcon = group.icon
            return (
              <section className={`nav-group${hasActiveItem ? ' active' : ''}`} aria-label={group.label} key={group.label}>
                <button type="button" className="nav-group-toggle" aria-label={`${group.label} navigation group`} aria-expanded={isExpanded} onClick={() => toggleGroup(group.label)}>
                  <span className="nav-group-title">
                    <span className="nav-group-icon"><GroupIcon size={18} /></span>
                    <span>{group.label}</span>
                  </span>
                  <ChevronRight className="nav-group-chevron" size={15} />
                </button>
                <div className={`nav-group-items${isExpanded ? ' expanded' : ''}`}>
                  {isExpanded && group.items.map(({ key, label }) => (
                    <button
                      key={key}
                      aria-current={key === activePage ? 'page' : undefined}
                      aria-label={label}
                      className={key === activePage ? 'nav-subitem active' : 'nav-subitem'}
                      onClick={() => selectPage(key)}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </nav>

        <footer className="sidebar-footer">
          <div className="sidebar-portal" title={isCollapsed ? 'Admin Portal' : undefined}>
            <span className="sidebar-portal-mark" aria-hidden="true">
              <Info size={15} />
            </span>
            <div className="sidebar-label">
              <strong>Admin Portal</strong>
              <small>Version 0.0.1</small>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout destructive-action"
            aria-label="Logout"
            title={isCollapsed ? 'Logout' : undefined}
            onClick={onLogout}
          >
            <span className="sidebar-footer-icon">
              <IconlyLogout size={16} />
            </span>
            <span className="sidebar-label">Log out</span>
          </button>
        </footer>
      </aside>

      <div className="admin-workspace" inert={isNarrowViewport && isOpen ? true : undefined}>
        <header className="utility-header">
          <button
            ref={menuRef}
            className="icon-button menu-button"
            aria-controls="main-navigation"
            aria-expanded={isOpen}
            aria-label="Open navigation"
            onClick={() => setIsOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="utility-context">
            <span className="utility-context-name">{contextText}</span>
            <span className="utility-breadcrumb-separator" aria-hidden="true">/</span>
            <h1 className="utility-page-title">{pageTitle}</h1>
          </div>

          <div className="utility-actions">
            {apiState === 'demo' && (
              <span className="service-warning" role="status">
                Service temporarily unavailable
              </span>
            )}
            <div className="header-notification-wrapper">
              <button
                type="button"
                className={`header-notification-button ${isNotifOpen ? 'active' : ''}`}
                aria-label="Notifications"
                aria-expanded={isNotifOpen}
                onClick={() => setIsNotifOpen((prev) => !prev)}
              >
                <IconlyBell size={20} />
                {unreadNotifCount > 0 && <span className="notification-dot" aria-hidden="true" />}
              </button>

              <AdminNotificationPopover
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
                onUnreadCountChange={setUnreadNotifCount}
              />
            </div>
            <div className="user-profile">
              <span className="user-avatar">{initial}</span>
              <span className="user-name">{user.name}</span>
            </div>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  )
}
