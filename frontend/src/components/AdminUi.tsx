import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import './AdminUi.css'

export type UiTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  )
}

type StatCardProps = {
  label: string
  value: ReactNode
  tone?: UiTone
  icon?: ReactNode
  meta?: ReactNode
  onClick?: () => void
  actionLabel?: string
}

export function StatCard({ label, value, tone = 'neutral', icon, meta, onClick, actionLabel }: StatCardProps) {
  const content = (
    <>
      {icon && (
        <span className="stat-card-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="stat-card-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {meta && <small>{meta}</small>}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`stat-card ${tone} interactive`}
        aria-label={actionLabel ?? label}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return <article className={`stat-card ${tone}`}>{content}</article>
}

export function FilterToolbar({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <section className="filter-toolbar" aria-label={ariaLabel}>
      {children}
    </section>
  )
}

type DataPanelProps = {
  title: string
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function DataPanel({ title, eyebrow, action, children, className = '' }: DataPanelProps) {
  return (
    <section className={`data-panel ${className}`.trim()} aria-label={title}>
      <header className="data-panel-header">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action && <div className="data-panel-action">{action}</div>}
      </header>
      <div className="data-panel-body">{children}</div>
    </section>
  )
}

type ModalFrameProps = {
  title: string
  description?: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  className?: string
}

export function ModalFrame({
  title,
  description,
  onClose,
  footer,
  children,
  className = '',
}: ModalFrameProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`modal-frame ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">{footer}</footer>
      </section>
    </div>
  )
}

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: UiTone
  children: ReactNode
}) {
  return <span className={`status-badge ${tone}`}>{children}</span>
}

export function InlineMessage({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success'
  children: ReactNode
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle

  return (
    <div className={`inline-message ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={17} />
      <span>{children}</span>
    </div>
  )
}

export function SessionLoader({ logoSrc, brand }: { logoSrc: string; brand: string }) {
  return (
    <main className="session-screen">
      <section className="session-card">
        <img src={logoSrc} alt="MIS logo" />
        <p className="eyebrow">{brand}</p>
        <h1>Checking your session</h1>
        <div className="session-progress" aria-hidden="true">
          <span />
        </div>
        <p role="status">Verifying your secure admin access...</p>
      </section>
    </main>
  )
}
