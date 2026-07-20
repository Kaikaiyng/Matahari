import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LogOut, Menu, X } from 'lucide-react'
import './AdminShell.css'

export type NavigationItem<PageKey extends string> = {
  key: PageKey
  label: string
  icon: LucideIcon
}

export type NavigationGroup<PageKey extends string> = {
  label: string
  items: NavigationItem<PageKey>[]
}

type AdminShellProps<PageKey extends string> = {
  brandLogo: string
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
  brandLogo,
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
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    window.matchMedia('(max-width: 1023px)').matches,
  )
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(false)

  const closeDrawer = useCallback((restoreFocus = true) => {
    shouldRestoreFocusRef.current = restoreFocus
    setIsOpen(false)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('nav-open', isOpen)

    return () => document.body.classList.remove('nav-open')
  }, [isOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
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
    <div className="admin-shell">
      <button
        className="sidebar-backdrop"
        aria-label="Close navigation backdrop"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={() => closeDrawer()}
      />

      <aside
        className={isOpen ? 'admin-sidebar open' : 'admin-sidebar'}
        id="main-navigation"
        aria-hidden={isNarrowViewport && !isOpen ? true : undefined}
        inert={isNarrowViewport && !isOpen ? true : undefined}
      >
        <div className="admin-brand">
          <img src={brandLogo} alt="MIS logo" />
          <div>
            <strong>MIS</strong>
            <span>School ERP</span>
          </div>
          <button
            ref={closeRef}
            className="icon-button drawer-close"
            aria-label="Close navigation"
            onClick={() => closeDrawer()}
          >
            <X size={19} />
          </button>
        </div>

        <nav aria-label="Main navigation">
          {navGroups.map((group) => (
            <section className="nav-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  aria-current={key === activePage ? 'page' : undefined}
                  aria-label={label}
                  className={key === activePage ? 'nav-item active' : 'nav-item'}
                  onClick={() => selectPage(key)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
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
            <span>{contextText}</span>
            <h1>{pageTitle}</h1>
          </div>

          <div className="utility-actions">
            {apiState === 'demo' && (
              <span className="service-warning" role="status">
                Service temporarily unavailable
              </span>
            )}
            <div className="user-chip">
              <span>{initial}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.username}</small>
              </div>
            </div>
            <button className="icon-button" aria-label="Logout" onClick={onLogout}>
              <LogOut size={19} />
            </button>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  )
}
