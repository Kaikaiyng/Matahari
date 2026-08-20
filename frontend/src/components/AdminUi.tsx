import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Info, X } from 'lucide-react'
import { productBrand } from '../branding'
import { useTenantConfiguration } from '../tenant'
import { BrandMark } from './BrandMark'
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
  title: ReactNode
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function DataPanel({ title, eyebrow, action, children, className = '' }: DataPanelProps) {
  const ariaLabel = typeof title === 'string' ? title : undefined
  return (
    <section className={`data-panel ${className}`.trim()} aria-label={ariaLabel}>
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

export type ModalSize = 'compact' | 'standard' | 'workflow'
export type ModalTone = 'default' | 'danger'
export type ModalPlacement = 'center' | 'drawer'

type ModalFrameProps = {
  title: string
  description?: string
  size?: ModalSize
  tone?: ModalTone
  placement?: ModalPlacement
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function modalFocusableElements(dialog: HTMLElement | null) {
  if (!dialog) return []

  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.closest('[hidden], [aria-hidden="true"]'),
  )
}

// oxlint-disable-next-line react/only-export-components
export function focusFirstDialogError() {
  requestAnimationFrame(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    const target =
      dialog?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      dialog?.querySelector<HTMLElement>('[role="alert"][tabindex="-1"]')
    target?.focus({ preventScroll: true })
    target?.scrollIntoView?.({ block: 'nearest' })
  })
}

export function ModalFrame({
  title,
  description,
  size = 'standard',
  tone = 'default',
  placement = 'center',
  onClose,
  footer,
  children,
  className = '',
  initialFocusRef,
}: ModalFrameProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const [scrollEdges, setScrollEdges] = useState({ top: false, bottom: false })
  onCloseRef.current = onClose

  const updateScrollEdges = () => {
    const body = bodyRef.current
    if (!body) return

    const nextEdges = {
      top: body.scrollTop > 1,
      bottom: body.scrollTop + body.clientHeight < body.scrollHeight - 1,
    }

    setScrollEdges((current) =>
      current.top === nextEdges.top && current.bottom === nextEdges.bottom
        ? current
        : nextEdges,
    )
  }

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return

    updateScrollEdges()
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollEdges)
    const mutationObserver =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(updateScrollEdges)
    resizeObserver?.observe(body)
    mutationObserver?.observe(body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', updateScrollEdges)

    return () => {
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', updateScrollEdges)
    }
  }, [])

  useEffect(() => {
    const root = document.getElementById('root')
    const rootHadInert = root?.hasAttribute('inert') ?? false
    const previousAriaHidden = root?.getAttribute('aria-hidden')
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    previousFocusRef.current = document.activeElement as HTMLElement | null

    root?.setAttribute('inert', '')
    root?.setAttribute('aria-hidden', 'true')
    const documentWidth = document.documentElement.clientWidth
    const scrollbarWidth = documentWidth > 0 ? Math.max(0, window.innerWidth - documentWidth) : 0
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'
    ;(initialFocusRef?.current ?? closeButtonRef.current)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const controls = modalFocusableElements(dialogRef.current)
      if (!controls.length) return

      const first = controls[0]
      const last = controls[controls.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (!rootHadInert) root?.removeAttribute('inert')
      if (previousAriaHidden == null) root?.removeAttribute('aria-hidden')
      else root?.setAttribute('aria-hidden', previousAriaHidden)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [initialFocusRef])

  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className={[
          'modal-frame',
          `modal-frame--${size}`,
          `modal-frame--${tone}`,
          `modal-frame--${placement}`,
          className,
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className={`modal-header${scrollEdges.top ? ' is-scrolled' : ''}`}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
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
        <div ref={bodyRef} className="modal-body" onScroll={updateScrollEdges}>
          {children}
        </div>
        <footer className={`modal-footer${scrollEdges.bottom ? ' has-more' : ''}`}>
          {footer}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

export type ModalContextItem = {
  label: string
  value: ReactNode
}

export function ModalContextSummary({
  ariaLabel,
  tone = 'default',
  items,
  consequence,
}: {
  ariaLabel: string
  tone?: ModalTone
  items: ModalContextItem[]
  consequence?: ReactNode
}) {
  return (
    <section
      className={`modal-context-summary modal-context-summary--${tone}`}
      aria-label={ariaLabel}
    >
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {consequence && <p className="modal-context-consequence">{consequence}</p>}
    </section>
  )
}

// oxlint-disable-next-line react/only-export-components
export function fieldErrorProps(errorId: string, message?: string) {
  return {
    'aria-invalid': message ? true : undefined,
    'aria-describedby': message ? errorId : undefined,
  } as const
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <small className="field-error" id={id}>
      {message}
    </small>
  ) : null
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

export function SessionLoader() {
  const tenant = useTenantConfiguration()
  return (
    <main className="session-screen">
      <section className="session-card">
        <BrandMark className="session-brand-mark" />
        <p className="eyebrow">{tenant.branding.organization_name || productBrand.productName}</p>
        <h1>Checking your session</h1>
        <div className="session-progress" aria-hidden="true">
          <span />
        </div>
        <p role="status">Verifying your secure admin access...</p>
      </section>
    </main>
  )
}

export type CustomSelectOption<T extends string | number = string> = {
  value: T
  label: string
  disabled?: boolean
  meta?: string
}

export type CustomSelectProps<T extends string | number = string> = {
  value: T
  onChange: (value: T) => void
  options: Array<CustomSelectOption<T>>
  placeholder?: string
  ariaLabel?: string
  id?: string
  className?: string
  disabled?: boolean
  size?: 'compact' | 'standard'
}

export function CustomSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  id,
  className = '',
  disabled = false,
  size = 'standard',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${size} ${disabled ? 'disabled' : ''} ${className}`}
    >
      <select
        id={id}
        aria-label={ariaLabel}
        className="custom-select-native-peer"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        tabIndex={-1}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        className={`custom-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="custom-select-label">
          {selectedOption ? selectedOption.label : placeholder || 'Select option'}
        </span>
        <ChevronDown size={15} className={`custom-select-arrow ${isOpen ? 'is-open' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown" role="listbox" tabIndex={-1}>
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                className={`custom-select-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
              >
                <span className="custom-select-option-label">{opt.label}</span>
                {isSelected && <Check size={14} className="custom-select-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
