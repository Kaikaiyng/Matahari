# Responsive Modal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade every Matahari dialog so PC and iPad users can identify the task, find the core work, recover from errors, and complete or cancel safely.

**Architecture:** Keep `ModalFrame` as the only dialog primitive, but render it through a body portal and add explicit size/tone contracts, focus containment, background isolation, and scroll cues. Reuse two small shared helpers (`ModalContextSummary` and field-error utilities), then migrate standard forms, Fee Agreement, Record Payment, and financial confirmations in independently testable tasks.

**Tech Stack:** React 19, TypeScript 6, React DOM portals, CSS media queries, Vitest 4, Testing Library, `user-event`, Vite 8, oxlint.

## What Already Exists

- `ModalFrame` already owns title, description, Close, Escape handling, a scrollable body, a fixed footer, and focus restoration. Task 1 strengthens this component instead of introducing a second dialog system.
- `PaymentAllocationEditor` already owns outstanding-fee loading, empty, error, refresh, selection, one-time charge, allocation, and unclassified-payment states. Task 6 adds one ordered slot and keeps those branches in place.
- `FeeAgreementEditor` and `AgreementReviewPanel` already compute version context, totals, warnings, and changes. Task 5 moves their presentation order without duplicating finance calculations.
- `CalendarPage` already owns add/edit/view/delete permissions, request serialization, unsaved edit restoration after delete cancellation, and paired date/time controls.
- Backend request validators remain the authority for payment, verification, void, student, and Calendar rules. Frontend changes expose and focus their errors; they do not copy business validation into a new layer.
- Vitest, Testing Library, the authenticated API fixture, and focused component tests already cover the affected modules.

## NOT in Scope

- Redesigning the receipt viewer/print sheet, dashboards, tables, navigation, global typography, or the product color system.
- Changing permissions, API endpoints, request/response payloads, finance calculations, fee generation, receipt numbering, or void business rules.
- Adding a component library, modal manager, state framework, device detection, user-agent checks, or new runtime dependency.
- Adding a new Calendar unsaved-change confirmation; the current caller-owned close behavior remains.
- Claiming physical iPad Safari, virtual-keyboard, safe-area, momentum-scroll, or VoiceOver behavior as passed without a real device run.

## Execution and Recovery Flow

```text
Page trigger
  |
  v
Caller state selects the exact student / payment / receipt / event
  |
  v
ModalFrame portal -> document.body
  |                  |
  |                  +-> #root inert + aria-hidden
  |                  +-> body scroll locked
  |                  +-> initial focus + Tab loop + Escape
  v
Context summary -> task sections -> fixed footer actions
  |
  +-> submit succeeds -> caller refreshes existing data -> modal unmounts
  |                                             |
  |                                             +-> trigger focus restored
  |
  +-> validation fails -> preserve caller form state
                         |
                         +-> render associated FieldError / alert
                         +-> open containing details section
                         +-> focusFirstDialogError()
                         +-> scroll the first recovery target into view
```

## Global Constraints

- Preserve all backend business rules, permissions, API payloads, finance calculations, and receipt print behavior.
- Add no component library, state-management framework, or new runtime dependency.
- Keep `ModalFrame` header and footer fixed; only `.modal-body` scrolls.
- Render the modal through `createPortal(..., document.body)` and isolate `#root`; backdrop clicks do not close dialogs.
- Support mutually exclusive viewport ranges: PC `>=1181px`, iPad landscape `1024–1180px`, iPad portrait `768–1023px`, phone `<768px`.
- Verify at PC `1440×900`, iPad landscape `1180×820`, iPad portrait `820×1180`, and phone regression `390×844`.
- Use `compact` at 560px/640px, `standard` at 720px/760px, and `workflow` at 1120px/860px, always constrained by safe margins and `100dvh`.
- Preserve the current visual language and CSS variables; do not redesign global typography, navigation, tables, or dashboards.
- Use user-facing `One-time Charge`; keep internal manual-charge names and API fields unchanged.
- Keep footer DOM, visual, and keyboard order aligned: safe secondary action first, primary action second.
- Focus the first meaningful field for editable forms, the safe Cancel action for danger dialogs, and Close for read-only dialogs.
- Never hide a validation error inside a collapsed section.
- Treat real iPad Safari behavior as unverified until checked on a physical device.

---

## File Responsibility Map

| File | Responsibility in this change |
| --- | --- |
| `frontend/src/components/AdminUi.tsx` | Portal dialog behavior, size/tone props, focus containment, scroll cues, context summary, field-error helpers |
| `frontend/src/components/AdminUi.css` | Modal size contracts, safe margins, fixed regions, overflow cues, footer layout, summary/danger presentation |
| `frontend/src/components/AdminUi.test.tsx` | Shared dialog semantics, focus, portal, inert/scroll cleanup, summary and error helpers |
| `frontend/src/App.tsx` | Student, one-time charge, Fee Agreement shell, Record Payment, Verify/Void Payment, Void Receipt dialog composition |
| `frontend/src/App.css` | Dialog-specific grids, payment workflow composition, iPad form rules, removal of `.financial-modal` width ownership |
| `frontend/src/App.test.tsx` | Role-accessible dialog inventory, copy, hierarchy, financial context, guard and error behavior |
| `frontend/src/components/CalendarPage.tsx` | Stable Calendar titles, view-only behavior, danger summary, focus and validation recovery |
| `frontend/src/components/CalendarPage.css` | Calendar dialog grid and footer behavior |
| `frontend/src/components/CalendarPage.test.tsx` | Add/Edit/View/Delete semantics, focus, context, errors and delete recovery |
| `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx` | Version/review/main grid areas and Payment Plan focus ref |
| `frontend/src/features/fee-agreements/AgreementReviewPanel.tsx` | Early compact review summary and expandable details |
| `frontend/src/features/fee-agreements/FeeAgreementEditor.css` | Desktop sticky review and iPad early-summary layout |
| `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx` | Review order, counts, details disclosure and focus |
| `frontend/src/features/payments/PaymentAllocationEditor.tsx` | Explicit post-allocation slot and ordered outstanding/allocation/summary/advanced regions |
| `frontend/src/features/payments/PaymentAllocationEditor.test.tsx` | Slot order, empty/loading/error states and existing allocation behavior |

The feature is one plan rather than separate sub-projects because every dialog depends on the same portal, focus, size, action, error, and context contracts. Splitting the finance and calendar work before that shared primitive lands would duplicate migration and QA work.

## Dependency and Parallelization

| Lane | Tasks | Modules | Dependency |
| --- | --- | --- | --- |
| Foundation | Task 1 → Task 2 | `components/` | None |
| App workflows | Task 3 → Task 5 → Task 6 → Task 7 → Task 8 | `App.*`, fee/payment features | Foundation |
| Calendar | Task 4 | `components/CalendarPage.*` | Foundation |
| Acceptance | Task 9 | all touched frontend modules | App workflows + Calendar |

After Tasks 1–2 land, Calendar can run independently from the App workflow lane. Tasks 3, 5, 6, 7, and 8 stay sequential because each changes `App.tsx` or its App tests; parallel worktrees there would create avoidable merge conflicts. Task 9 starts only after both lanes merge.

### Task 1: Make `ModalFrame` a complete dialog primitive

**Files:**
- Modify: `frontend/src/components/AdminUi.tsx`
- Modify: `frontend/src/components/AdminUi.css`
- Test: `frontend/src/components/AdminUi.test.tsx`

**Interfaces:**
- Consumes: existing `title`, `description`, `onClose`, `footer`, `children`, and `className` props.
- Produces:
  - `export type ModalSize = 'compact' | 'standard' | 'workflow'`
  - `export type ModalTone = 'default' | 'danger'`
  - `size?: ModalSize`
  - `tone?: ModalTone`
  - `initialFocusRef?: RefObject<HTMLElement | null>`
  - `export function focusFirstDialogError(): void`

- [ ] **Step 1: Write failing portal, semantics, focus, cleanup, and size tests**

Add imports for `createRef`, `within`, `waitFor`, `fireEvent`, and `afterEach`. Add a focused harness and tests:

```tsx
function DialogHarness({
  onClose,
  initialFocusRef,
}: {
  onClose: () => void
  initialFocusRef?: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <ModalFrame
      title="Record Payment"
      description="Allocate this payment."
      size="workflow"
      tone="danger"
      initialFocusRef={initialFocusRef}
      onClose={onClose}
      footer={
        <>
          <button>Cancel</button>
          <button>Save</button>
        </>
      }
    >
      <input ref={initialFocusRef} aria-label="Amount" />
      <button>Inside action</button>
    </ModalFrame>
  )
}

afterEach(() => {
  document.querySelectorAll('#root').forEach((root) => root.remove())
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
})

it('portals the dialog, associates its description, and isolates the app root', async () => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)

  render(<DialogHarness onClose={() => undefined} />, { container: root })

  const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
  expect(dialog.parentElement).toBe(document.body.querySelector('.modal-backdrop'))
  expect(dialog).toHaveClass('modal-frame--workflow', 'modal-frame--danger')
  expect(dialog).toHaveAccessibleDescription('Allocate this payment.')
  expect(root).toHaveAttribute('inert')
  expect(root).toHaveAttribute('aria-hidden', 'true')
  expect(document.body.style.overflow).toBe('hidden')
})

it('uses initial focus and traps Tab in both directions', async () => {
  const user = userEvent.setup()
  const amountRef = createRef<HTMLInputElement>()
  render(<DialogHarness onClose={() => undefined} initialFocusRef={amountRef} />)

  await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveFocus())
  const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
  const controls = within(dialog).getAllByRole('button')

  controls.at(-1)!.focus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Close Record Payment' })).toHaveFocus()

  screen.getByRole('button', { name: 'Close Record Payment' }).focus()
  await user.tab({ shift: true })
  expect(controls.at(-1)).toHaveFocus()
})

it('restores previous root and body state when removed', async () => {
  const root = document.createElement('div')
  root.id = 'root'
  root.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'clip'
  document.body.append(root)
  const trigger = document.createElement('button')
  trigger.textContent = 'Open'
  document.body.append(trigger)
  trigger.focus()

  const view = render(<DialogHarness onClose={() => undefined} />, { container: root })
  view.unmount()

  expect(root).not.toHaveAttribute('inert')
  expect(root).toHaveAttribute('aria-hidden', 'false')
  expect(document.body.style.overflow).toBe('clip')
  expect(trigger).toHaveFocus()
})

it('preserves a pre-existing inert root attribute', () => {
  const root = document.createElement('div')
  root.id = 'root'
  root.setAttribute('inert', '')
  document.body.append(root)

  const view = render(<DialogHarness onClose={() => undefined} />, { container: root })
  view.unmount()

  expect(root).toHaveAttribute('inert')
})

it('routes Escape through the caller close behavior', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<DialogHarness onClose={onClose} />)

  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('does not close from a backdrop click', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<DialogHarness onClose={onClose} />)

  await user.click(document.querySelector('.modal-backdrop')!)
  expect(onClose).not.toHaveBeenCalled()
})

it('shows overflow cues only on edges with hidden content', () => {
  render(<DialogHarness onClose={() => undefined} />)
  const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
  const body = dialog.querySelector<HTMLElement>('.modal-body')!
  const header = dialog.querySelector('.modal-header')
  const footer = dialog.querySelector('.modal-footer')

  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 300 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  })

  fireEvent.scroll(body)
  expect(header).not.toHaveClass('is-scrolled')
  expect(footer).toHaveClass('has-more')

  body.scrollTop = 200
  fireEvent.scroll(body)
  expect(header).toHaveClass('is-scrolled')
  expect(footer).not.toHaveClass('has-more')
})
```

- [ ] **Step 2: Run the focused test and confirm the new expectations fail**

Run:

```powershell
cd frontend
npm.cmd run test -- src/components/AdminUi.test.tsx
```

Expected: FAIL because the dialog is not portaled, has no size/tone classes, does not trap focus, does not isolate `#root`, and does not lock body scrolling.

- [ ] **Step 3: Implement the portal, focus, cleanup, scroll-edge, and error-focus behavior**

Replace the current `ModalFrame` implementation with the following structure. Keep the existing public components below it unchanged.

```tsx
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'

export type ModalSize = 'compact' | 'standard' | 'workflow'
export type ModalTone = 'default' | 'danger'

type ModalFrameProps = {
  title: string
  description?: string
  size?: ModalSize
  tone?: ModalTone
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

export function focusFirstDialogError() {
  requestAnimationFrame(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    const target = dialog?.querySelector<HTMLElement>(
      '[aria-invalid="true"], [role="alert"][tabindex="-1"]',
    )
    target?.focus({ preventScroll: true })
    target?.scrollIntoView?.({ block: 'nearest' })
  })
}

export function ModalFrame({
  title,
  description,
  size = 'standard',
  tone = 'default',
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
    const mutationObserver = new MutationObserver(updateScrollEdges)
    resizeObserver?.observe(body)
    mutationObserver.observe(body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', updateScrollEdges)
    return () => {
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
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
      if (previousAriaHidden === null) root?.removeAttribute('aria-hidden')
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
```

Do not add an `onClick` handler to `.modal-backdrop`. Keep the previous body padding value even though scrollbar compensation is not introduced in this task.

- [ ] **Step 4: Implement the size, safe-area, fixed-region, and footer CSS**

Replace `.modal-frame` width ownership and add explicit variants:

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  height: 100dvh;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding:
    max(16px, env(safe-area-inset-top))
    max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
  background: rgb(12 14 18 / 58%);
  backdrop-filter: blur(3px);
}

.modal-frame {
  --modal-width: 720px;
  --modal-max-height: 760px;
  width: min(var(--modal-width), 100%);
  max-height: min(var(--modal-max-height), 100%);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 14px;
  background: var(--surface, #ffffff);
  box-shadow: 0 24px 70px rgb(0 0 0 / 28%);
}

.modal-frame--compact {
  --modal-width: 560px;
  --modal-max-height: 640px;
}

.modal-frame--standard {
  --modal-width: 720px;
  --modal-max-height: 760px;
}

.modal-frame--workflow {
  --modal-width: 1120px;
  --modal-max-height: 860px;
}

.modal-frame--danger {
  border-color: rgb(179 25 35 / 35%);
}

.modal-header.is-scrolled {
  box-shadow: 0 8px 18px rgb(25 28 34 / 8%);
}

.modal-footer.has-more {
  box-shadow: 0 -8px 18px rgb(25 28 34 / 8%);
}

.modal-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 22px;
}

@media screen and (min-width: 1024px) and (max-width: 1180px) {
  .modal-backdrop {
    padding:
      max(20px, env(safe-area-inset-top))
      max(20px, env(safe-area-inset-right))
      max(20px, env(safe-area-inset-bottom))
      max(20px, env(safe-area-inset-left));
  }
}

@media screen and (min-width: 768px) and (max-width: 1180px) {
  .modal-frame button,
  .modal-frame input:not([type='checkbox']):not([type='radio']),
  .modal-frame select {
    min-height: 44px;
  }
}

@media screen and (max-width: 1023px) {
  .modal-footer {
    flex-wrap: nowrap;
  }

  .modal-footer .primary-action {
    width: auto;
    min-width: 160px;
  }
}

@media screen and (max-width: 640px) {
  .modal-backdrop {
    align-items: end;
    padding:
      max(8px, env(safe-area-inset-top))
      max(8px, env(safe-area-inset-right))
      max(8px, env(safe-area-inset-bottom))
      max(8px, env(safe-area-inset-left));
  }

  .modal-frame {
    max-height: 100%;
    border-radius: 14px 14px 10px 10px;
  }

  .modal-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .modal-footer .secondary-action,
  .modal-footer .primary-action {
    width: 100%;
    min-width: 0;
  }
}
```

Delete `.modal-frame.wide`. Do not remove the page-level `.primary-action { width: 100% }` rule yet; the modal-scoped rule above must override it without changing page actions.

- [ ] **Step 5: Run shared tests, lint, and build**

Run:

```powershell
cd frontend
npm.cmd run test -- src/components/AdminUi.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0. The focused test must prove portal placement, `aria-describedby`, focus loop, Escape, explicit initial focus, root/body cleanup, and non-closing backdrop.

- [ ] **Step 6: Commit the shared primitive**

```powershell
git add frontend/src/components/AdminUi.tsx frontend/src/components/AdminUi.css frontend/src/components/AdminUi.test.tsx
git commit -m "feat: complete modal frame behavior"
```

### Task 2: Add semantic context and field-error helpers

**Files:**
- Modify: `frontend/src/components/AdminUi.tsx`
- Modify: `frontend/src/components/AdminUi.css`
- Test: `frontend/src/components/AdminUi.test.tsx`

**Interfaces:**
- Consumes: `ModalTone` from Task 1.
- Produces:
  - `export type ModalContextItem = { label: string; value: ReactNode }`
  - `export function ModalContextSummary(props): JSX.Element`
  - `export function fieldErrorProps(errorId: string, message?: string): object`
  - `export function FieldError(props): JSX.Element | null`

- [ ] **Step 1: Write failing semantic-summary and field-error tests**

```tsx
it('renders modal context as a labelled definition list with a written consequence', () => {
  render(
    <ModalContextSummary
      ariaLabel="Payment context"
      tone="danger"
      items={[
        { label: 'Student', value: 'Alyssa Tan / MIS-2026-001' },
        { label: 'Amount', value: 'RM 400' },
      ]}
      consequence="Applied charges will reopen."
    />,
  )

  const summary = screen.getByRole('region', { name: 'Payment context' })
  expect(summary).toHaveClass('modal-context-summary--danger')
  expect(within(summary).getByText('Student').closest('div')).toHaveTextContent(
    'Alyssa Tan / MIS-2026-001',
  )
  expect(within(summary).getByText('Applied charges will reopen.')).toBeInTheDocument()
})

it('associates an invalid control with its field error', () => {
  const message = 'Amount is required.'
  render(
    <label>
      Amount
      <input aria-label="Amount" {...fieldErrorProps('amount-error', message)} />
      <FieldError id="amount-error" message={message} />
    </label>,
  )

  expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-describedby', 'amount-error')
  expect(screen.getByText(message)).toHaveAttribute('id', 'amount-error')
})
```

- [ ] **Step 2: Run the focused test and confirm missing exports fail**

Run:

```powershell
cd frontend
npm.cmd run test -- src/components/AdminUi.test.tsx
```

Expected: FAIL because `ModalContextSummary`, `fieldErrorProps`, and `FieldError` do not exist.

- [ ] **Step 3: Implement the shared helpers**

```tsx
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
```

- [ ] **Step 4: Add calm default and explicit danger summary styles**

```css
.modal-context-summary {
  display: grid;
  gap: 12px;
  border: 1px solid var(--border, #e1e4ea);
  border-radius: 10px;
  background: #f8f9fb;
  padding: 14px 16px;
}

.modal-context-summary dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin: 0;
}

.modal-context-summary dl > div {
  min-width: 0;
}

.modal-context-summary dt,
.modal-context-summary dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.modal-context-summary dt {
  color: var(--muted, #737782);
  font-size: 12px;
  font-weight: 700;
}

.modal-context-summary dd {
  margin-top: 3px;
  color: var(--text, #25272d);
  font-size: 14px;
  font-weight: 800;
}

.modal-context-summary--danger {
  border-color: #efb8bd;
  background: #fff3f4;
}

.modal-context-consequence {
  margin: 0;
  border-top: 1px solid currentColor;
  padding-top: 10px;
  color: var(--brand-red-dark, #b31923);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.5;
}
```

- [ ] **Step 5: Run tests and commit**

```powershell
cd frontend
npm.cmd run test -- src/components/AdminUi.test.tsx
npm.cmd run lint
cd ..
git add frontend/src/components/AdminUi.tsx frontend/src/components/AdminUi.css frontend/src/components/AdminUi.test.tsx
git commit -m "feat: add modal context helpers"
```

Expected: tests and lint exit 0; the commit contains only the shared summary/error helper unit.

### Task 3: Migrate Create Student and One-time Charge

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `ModalFrame`, `ModalContextSummary`, `FieldError`, `fieldErrorProps`, and `focusFirstDialogError` from Tasks 1–2.
- Produces: explicit standard-size forms, two-column iPad field grids, stable initial focus, and user-facing `One-time Charge` copy.

- [ ] **Step 1: Update inventory tests to require the final titles, context, and focus**

Add a role-specific fixture and API-user helper near the other App test fixtures:

```tsx
const schoolAdminDialogUser = {
  ...currentUser,
  roles: ['school-admin'],
  permissions: [
    'students.view',
    'students.create',
    'fee_agreements.create',
    'fee_agreements.update',
    'fee_record.view',
    'fee_record.manage',
    'payments.view',
    'payments.create',
    'receipts.view',
  ],
}

function installApiUser(user: typeof currentUser) {
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/me')) return json({ user })
    return installedImplementation(input, init)
  })
}
```

Change the existing dialog-inventory assertions and add focused tests:

```tsx
it('opens Create Student at Student ID with the standard modal contract', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Add Student' }))

  const dialog = screen.getByRole('dialog', { name: 'Create Student Profile' })
  expect(dialog).toHaveClass('modal-frame--standard')
  await waitFor(() => expect(within(dialog).getByLabelText('Student ID')).toHaveFocus())
})

it('uses One-time Charge language and identifies the selected student', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Add One-time Charge' }))

  const dialog = screen.getByRole('dialog', { name: 'One-time Charge' })
  expect(dialog).toHaveClass('modal-frame--standard')
  expect(within(dialog).getByRole('region', { name: 'Student context' })).toHaveTextContent(
    'Alyssa Tan',
  )
  expect(within(dialog).getByRole('region', { name: 'Student context' })).toHaveTextContent(
    'MIS-2026-001',
  )
  await waitFor(() => expect(within(dialog).getByLabelText('Academic Year')).toHaveFocus())
  expect(within(dialog).getByRole('button', { name: 'Add One-time Charge' })).toBeInTheDocument()
})
```

Update the old expectations from `Add Manual Charge` to `Add One-time Charge` and from dialog title `Add Manual Charge` to `One-time Charge`.

- [ ] **Step 2: Run the two focused tests and confirm they fail**

Run:

```powershell
cd frontend
npm.cmd run test -- src/App.test.tsx -t "Create Student|One-time Charge"
```

Expected: FAIL on old Manual Charge copy, missing context summary, missing size contract, and missing form initial focus.

- [ ] **Step 3: Add form refs and explicit modal props**

Inside the component that owns these states, add:

```tsx
const createStudentIdRef = useRef<HTMLInputElement>(null)
const oneTimeChargeYearRef = useRef<HTMLInputElement>(null)
```

Add `size` and `initialFocusRef` to the existing Create Student `ModalFrame`, then attach the ref to the existing Student ID input:

```diff
 <ModalFrame
   title="Create Student Profile"
   description="Add enrolment and profile details."
+  size="standard"
+  initialFocusRef={createStudentIdRef}
   onClose={() => setShowCreateForm(false)}
```

```diff
 <input
+  ref={createStudentIdRef}
   value={form.student_no}
   onChange={(event) => updateForm('student_no', event.target.value)}
 />
```

Leave the existing footer and approved field order unchanged in this task; Task 8 replaces its error markup.

```tsx
<button
  className="table-action"
  onClick={() => {
    setShowManualChargeForm((value) => !value)
    setManualChargeErrors(undefined)
  }}
>
  {showManualChargeForm ? 'Close One-time Charge' : 'Add One-time Charge'}
</button>

<ModalFrame
  title="One-time Charge"
  description="Add a one-time charge to this student account."
  size="standard"
  initialFocusRef={oneTimeChargeYearRef}
  onClose={() => setShowManualChargeForm(false)}
  footer={
    <>
      <button type="button" className="secondary-action" onClick={() => setShowManualChargeForm(false)}>
        Cancel
      </button>
      <button
        className="primary-action compact"
        type="submit"
        form="manual-charge-form"
        disabled={isSavingManualCharge}
      >
        {isSavingManualCharge ? 'Adding...' : 'Add One-time Charge'}
      </button>
    </>
  }
>
  <ModalContextSummary
    ariaLabel="Student context"
    items={[
      { label: 'Student', value: selectedStudent?.full_name ?? 'Not selected' },
      { label: 'Student ID', value: selectedStudent?.student_no ?? 'Not recorded' },
    ]}
  />
  <form id="manual-charge-form" className="manual-charge-form" onSubmit={submitManualCharge} noValidate>
    <div className="form-grid one-time-charge-form-grid">
      <label className="form-field">
        Academic Year
        <input
          ref={oneTimeChargeYearRef}
          value={manualChargeForm.academic_year}
          onChange={(event) => updateManualChargeForm('academic_year', event.target.value)}
        />
      </label>
    </div>
  </form>
</ModalFrame>
```

Move the existing Billing Month, Category, Amount, Description, and Remark labels into `one-time-charge-form-grid` immediately after Academic Year, without changing their JSX or order. Keep state variables, request payload keys, endpoint names, and backend terminology unchanged.

- [ ] **Step 4: Scope Student and One-time Charge grids to the dialog**

```css
@media screen and (min-width: 1181px) {
  .student-form {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media screen and (min-width: 768px) and (max-width: 1180px) {
  .student-form,
  .one-time-charge-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .student-form .wide,
  .one-time-charge-form-grid .wide {
    grid-column: 1 / -1;
  }
}

@media screen and (max-width: 767px) {
  .student-form,
  .one-time-charge-form-grid {
    grid-template-columns: 1fr;
  }
}
```

Remove `.manual-charge-form .form-grid` from the generic iPad selector once the named grid owns its layout.

- [ ] **Step 5: Run App tests, lint, and build**

```powershell
cd frontend
npm.cmd run test -- src/App.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: all existing payload and finance tests still pass; only user-facing labels change.

- [ ] **Step 6: Commit the standard finance/student forms**

```powershell
git add frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx
git commit -m "feat: clarify standard modal forms"
```

### Task 4: Migrate Calendar Add, Edit, View, and Delete

**Files:**
- Modify: `frontend/src/components/CalendarPage.tsx`
- Modify: `frontend/src/components/CalendarPage.css`
- Test: `frontend/src/components/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: shared `ModalFrame`, `ModalContextSummary`, `FieldError`, `fieldErrorProps`, and `focusFirstDialogError`.
- Produces: stable Calendar dialog titles, standard/compact size contracts, read-only Close semantics, danger context, and safe initial focus.

- [ ] **Step 1: Replace dynamic-title tests with stable-title and context tests**

Update affected assertions and add:

```tsx
it('uses stable edit and delete titles while keeping the full event context', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderCalendar()
  await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))

  const editDialog = screen.getByRole('dialog', { name: 'Edit Calendar Event' })
  expect(editDialog).toHaveClass('modal-frame--standard')
  expect(within(editDialog).getByLabelText('Title')).toHaveValue('Parent Appointment')
  await waitFor(() => expect(within(editDialog).getByLabelText('Title')).toHaveFocus())

  await user.click(within(editDialog).getByRole('button', { name: 'Delete event' }))
  const deleteDialog = screen.getByRole('dialog', { name: 'Delete Calendar Event?' })
  expect(deleteDialog).toHaveClass('modal-frame--compact', 'modal-frame--danger')
  expect(within(deleteDialog).getByRole('region', { name: 'Event to delete' })).toHaveTextContent(
    'Parent Appointment',
  )
  await waitFor(() => expect(within(deleteDialog).getByRole('button', { name: 'Cancel deletion' })).toHaveFocus())
})

it('uses Close for a read-only event', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderCalendar(['calendar.view', 'calendar.delete'])
  await user.click(await screen.findByRole('button', { name: /Parent Appointment/ }))

  const dialog = screen.getByRole('dialog', { name: 'View Calendar Event' })
  expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
})
```

Change all existing expectations for `Edit Parent Appointment`, `Parent Appointment details`, and `Delete Parent Appointment?` to the stable titles above. Preserve the assertion that cancelling or escaping delete restores the edit form with unsaved values.

- [ ] **Step 2: Run Calendar tests and confirm title/focus/context failures**

Run:

```powershell
cd frontend
npm.cmd run test -- src/components/CalendarPage.test.tsx
```

Expected: FAIL on the old dynamic titles, old Cancel copy in read-only mode, missing danger context, and missing safe initial focus.

- [ ] **Step 3: Add explicit title, size, tone, and focus refs**

At component scope:

```tsx
const titleInputRef = useRef<HTMLInputElement>(null)
const viewCloseRef = useRef<HTMLButtonElement>(null)
const deleteCancelRef = useRef<HTMLButtonElement>(null)
```

Use:

```tsx
const calendarDialogTitle = editingEvent
  ? canUpdate
    ? 'Edit Calendar Event'
    : 'View Calendar Event'
  : 'Add Calendar Event'

<ModalFrame
  title={calendarDialogTitle}
  description={
    editingEvent
      ? canUpdate
        ? 'Update this calendar event.'
        : 'Review this calendar event.'
      : 'Add an event to the school calendar.'
  }
  size="standard"
  initialFocusRef={editingEvent && !canUpdate ? viewCloseRef : titleInputRef}
  onClose={closeForm}
  footer={
    <>
      {editingEvent && canDelete && (
        <button
          className="secondary-action danger-action calendar-delete-action"
          type="button"
          onClick={openDeleteConfirmation}
          disabled={isSaving}
        >
          Delete event
        </button>
      )}
      <button
        ref={editingEvent && !canUpdate ? viewCloseRef : undefined}
        className="secondary-action"
        type="button"
        onClick={closeForm}
        disabled={isSaving}
      >
        {editingEvent && !canUpdate ? 'Close' : 'Cancel'}
      </button>
      {(!editingEvent || canUpdate) && (
        <button className="primary-action compact" type="submit" form="calendar-event-form" disabled={isSaving}>
          {isSaving ? 'Saving…' : editingEvent ? 'Save changes' : 'Create event'}
        </button>
      )}
    </>
  }
>
  <form id="calendar-event-form" className="calendar-event-form" onSubmit={submitEvent}>
    {formError && <InlineMessage tone="error">{formError}</InlineMessage>}
    <fieldset className="calendar-form-grid" disabled={Boolean(editingEvent) && !canUpdate}>
      <label className="calendar-form-field wide">
        Title
        <input
          ref={titleInputRef}
          aria-label="Title"
          value={form.title}
          onChange={(event) => updateForm('title', event.target.value)}
          aria-invalid={Boolean(fieldErrors.title?.length)}
        />
        {fieldErrors.title?.map((message) => <small key={message}>{message}</small>)}
      </label>
    </fieldset>
  </form>
</ModalFrame>
```

The snippet shows the changed first field. Retain Event type, All-day event, Start date/time, End date/time, Location, Participants, and Notes after Title inside the same fieldset; do not change their current order or request serialization in this task.

For delete:

```tsx
<ModalFrame
  title="Delete Calendar Event?"
  description="This event will be permanently removed and cannot be recovered."
  size="compact"
  tone="danger"
  initialFocusRef={deleteCancelRef}
  onClose={closeDeleteConfirmation}
  footer={
    <>
      <button
        ref={deleteCancelRef}
        className="secondary-action"
        type="button"
        onClick={closeDeleteConfirmation}
        disabled={isDeleting}
      >
        Cancel deletion
      </button>
      <button
        className="primary-action compact calendar-confirm-delete"
        type="button"
        onClick={confirmDelete}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting…' : 'Delete event'}
      </button>
    </>
  }
>
  <ModalContextSummary
    ariaLabel="Event to delete"
    tone="danger"
    items={[
      { label: 'Event', value: eventToDelete.title },
      { label: 'Date and time', value: eventLabel(eventToDelete) },
      { label: 'Location', value: eventToDelete.location || 'Not recorded' },
    ]}
    consequence="This event cannot be recovered after deletion."
  />
  {deleteError && <InlineMessage tone="error">{deleteError}</InlineMessage>}
</ModalFrame>
```

- [ ] **Step 4: Keep Calendar date/time fields paired on iPad**

Retain the existing two-column `.calendar-form-grid` from 768px upward and one column below 768px. Add only:

```css
.calendar-event-form > .modal-context-summary {
  margin-bottom: 2px;
}

@media screen and (min-width: 768px) and (max-width: 1180px) {
  .calendar-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

Do not add a Calendar-specific footer reorder; shared modal footer rules own ordering.

- [ ] **Step 5: Run Calendar regression tests and commit**

```powershell
cd frontend
npm.cmd run test -- src/components/CalendarPage.test.tsx
npm.cmd run lint
npm.cmd run build
cd ..
git add frontend/src/components/CalendarPage.tsx frontend/src/components/CalendarPage.css frontend/src/components/CalendarPage.test.tsx
git commit -m "feat: clarify calendar dialogs"
```

Expected: Calendar tests preserve create/update/delete requests, unsaved edit restoration after delete cancel/Escape, and permission behavior.

### Task 5: Put Fee Agreement review before detailed editing on iPad

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- Modify: `frontend/src/features/fee-agreements/AgreementReviewPanel.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.css`
- Test: `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `ModalFrame size="workflow"`, `ModalContextSummary`, and caller-provided initial focus.
- Produces:
  - `paymentPlanRef?: RefObject<HTMLSelectElement | null>` on `FeeAgreementEditor`
  - CSS grid areas `version`, `main`, and `review`
  - native `details.agreement-review-details` for iPad disclosure

- [ ] **Step 1: Write failing layout-contract and review-content tests**

Add to `FeeAgreementEditor.test.tsx`:

```tsx
it('exposes version, review, and main regions in responsive source order', () => {
  render(<EditorHarness mode="supersede" agreement={currentAgreement} />)

  const editor = screen.getByTestId('fee-agreement-editor')
  const version = within(editor).getByText('Creating a new version from v1').closest(
    '.agreement-version-context',
  )
  const review = within(editor).getByRole('complementary', { name: 'Changes from v1' })
  const main = within(editor).getByRole('main')

  expect(version).toHaveClass('agreement-version-context')
  expect(review).toHaveClass('agreement-review-panel')
  expect(main).toHaveClass('fee-agreement-editor-main')
  expect(editor.children[0]).toBe(version)
  expect(editor.children[1]).toBe(main)
  expect(editor.children[2]).toBe(review)
})

it('shows the compact review facts before expandable detail', () => {
  render(<EditorHarness mode="supersede" agreement={currentAgreement} />)
  const review = screen.getByRole('complementary', { name: 'Changes from v1' })

  expect(within(review).getByText('Preview total').closest('div')).toHaveTextContent('RM 890')
  expect(within(review).getByText('Core fees').closest('div')).toHaveTextContent('2')
  expect(within(review).getByText('Coverage').closest('div')).toHaveTextContent(
    '2026-01-01 onward',
  )
  expect(within(review).getByText('Review details').closest('details')).not.toHaveAttribute('open')
})
```

Add to `App.test.tsx`:

```tsx
it('identifies the student and focuses Payment Plan in Fee Agreement', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Create Agreement' }))

  const dialog = screen.getByRole('dialog', { name: 'Create Fee Agreement' })
  expect(dialog).toHaveClass('modal-frame--workflow')
  expect(within(dialog).getByRole('region', { name: 'Student context' })).toHaveTextContent(
    'Alyssa Tan',
  )
  await waitFor(() => expect(within(dialog).getByLabelText('Payment Plan')).toHaveFocus())
})
```

- [ ] **Step 2: Run Fee Agreement tests and confirm failures**

```powershell
cd frontend
npm.cmd run test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx src/App.test.tsx -t "Fee Agreement|review facts|responsive source order"
```

Expected: FAIL because version context is nested inside main, the review lacks core-count/disclosure rows, and App does not provide student context or Payment Plan initial focus.

- [ ] **Step 3: Move version context to a named grid area and accept the focus ref**

Change the editor signature:

```tsx
import type { RefObject } from 'react'

export function FeeAgreementEditor({
  mode,
  form,
  errors,
  currentAgreement,
  onChange,
  paymentPlanRef,
}: {
  mode: 'create' | 'supersede'
  form: FeeAgreementForm
  errors: ValidationErrors | undefined
  currentAgreement: FeeAgreement | null
  onChange: (form: FeeAgreementForm) => void
  paymentPlanRef?: RefObject<HTMLSelectElement | null>
})
```

Add `data-testid="fee-agreement-editor"` to the root. Move the existing Supersede version-context block from inside `.fee-agreement-editor-main` to the first child of the root. Leave `.fee-agreement-editor-main` as the second child and `AgreementReviewPanel` as the third child. Keep the existing Details, Core fees, Optional fees, Manual discount, error-driven fee expansion, and discount expansion JSX unchanged.

Attach the new ref to the existing Payment Plan select:

```diff
 <select
+  ref={paymentPlanRef}
   value={form.payment_plan}
   onChange={(event) => update('payment_plan', event.target.value as PaymentPlan)}
 >
```

- [ ] **Step 4: Make the review facts always visible and details collapsible on iPad**

In `AgreementReviewPanel.tsx`, calculate and render:

```tsx
const coreFeeCount = form.items.filter(
  (item) => item.enabled && (item.code === 'TUITION' || item.code === 'MISC'),
).length
const coverage = `${form.effective_from}${form.effective_to ? ` to ${form.effective_to}` : ' onward'}`

<dl className="agreement-review-totals">
  <div>
    <dt>Coverage</dt>
    <dd>{coverage}</dd>
  </div>
  <div>
    <dt>Core fees</dt>
    <dd>{coreFeeCount}</dd>
  </div>
  <div>
    <dt>{mode === 'supersede' ? 'Changes' : 'Warnings'}</dt>
    <dd>{mode === 'supersede' ? changes.length : errorCount}</dd>
  </div>
</dl>

<details className="agreement-review-details">
  <summary>Review details</summary>
  <div className="agreement-review-detail-content">
    <div className="agreement-review-meta">
      <span>{coverage}</span>
      <span>{enabledItems.map((item) => item.name).join(', ')}</span>
    </div>
    {mode === 'supersede' && (
      <div className="agreement-change-list">
        <section>
          <strong>Coverage</strong>
          {coverageChanges.length > 0 ? (
            coverageChanges.map((change) => <p key={change.key}>{change.message}</p>)
          ) : (
            <p>No coverage changes.</p>
          )}
        </section>
        <section>
          <strong>Fee configuration</strong>
          {feeChanges.length > 0 ? (
            feeChanges.map((change) => <p key={change.key}>{change.message}</p>)
          ) : (
            <p>No fee configuration changes.</p>
          )}
        </section>
      </div>
    )}
  </div>
</details>
```

Append the three new `<div>` rows after the existing Subtotal, Discount, and Preview total rows. Move the existing review meta and change-list markup into `agreement-review-details`; do not duplicate it elsewhere in the DOM.

- [ ] **Step 5: Define desktop and iPad grid areas**

```css
.fee-agreement-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-areas:
    "version review"
    "main review";
  gap: 16px 20px;
  align-items: start;
}

.agreement-version-context {
  grid-area: version;
}

.fee-agreement-editor-main {
  grid-area: main;
}

.agreement-review-panel {
  grid-area: review;
  position: sticky;
  top: 0;
}

@media screen and (min-width: 1101px) {
  .agreement-review-details > summary {
    display: none;
  }

  .agreement-review-details:not([open]) > :not(summary) {
    display: block;
  }
}

@media screen and (max-width: 1100px) {
  .fee-agreement-editor {
    grid-template-columns: 1fr;
    grid-template-areas:
      "version"
      "review"
      "main";
  }

  .agreement-review-panel {
    position: static;
  }

  .agreement-review-details > summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    color: var(--brand-red-dark, #b31923);
    cursor: pointer;
    font-weight: 800;
  }
}
```

For Create mode, the empty `version` grid row collapses; the review appears before the editor on iPad.

- [ ] **Step 6: Add the workflow shell and student context in App**

```tsx
const feeAgreementPaymentPlanRef = useRef<HTMLSelectElement>(null)
```

Add these props to the existing Fee Agreement `ModalFrame` and remove `className="financial-modal"`:

```diff
 <ModalFrame
   title={feeAgreementMode === 'create' ? 'Create Fee Agreement' : 'Supersede Fee Agreement'}
+  size="workflow"
+  initialFocusRef={feeAgreementPaymentPlanRef}
```

Insert the summary as the first child of `fee-agreement-form`, before the existing item-level error:

```tsx
<ModalContextSummary
  ariaLabel="Student context"
  items={[
    { label: 'Student', value: selectedStudent?.full_name ?? 'Not selected' },
    { label: 'Student ID', value: selectedStudent?.student_no ?? 'Not recorded' },
  ]}
/>
```

Pass the ref to the existing editor:

```diff
 <FeeAgreementEditor
   mode={feeAgreementMode}
   form={feeAgreementForm}
   errors={feeAgreementErrors}
   currentAgreement={currentFeeAgreement}
   onChange={setFeeAgreementForm}
+  paymentPlanRef={feeAgreementPaymentPlanRef}
 />
```

- [ ] **Step 7: Run Fee Agreement and App tests, then commit**

```powershell
cd frontend
npm.cmd run test -- src/features/fee-agreements/FeeAgreementEditor.test.tsx src/App.test.tsx
npm.cmd run lint
npm.cmd run build
cd ..
git add frontend/src/App.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.tsx frontend/src/features/fee-agreements/AgreementReviewPanel.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.css frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx frontend/src/App.test.tsx
git commit -m "feat: surface fee agreement review early"
```

Expected: create/supersede request payloads and existing validation focus tests remain unchanged.

### Task 6: Recompose Record Payment around fees and balance

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/features/payments/PaymentAllocationEditor.tsx`
- Test: `frontend/src/features/payments/PaymentAllocationEditor.test.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `ModalFrame size="workflow"`, `ModalContextSummary`, existing payment form state and allocation callbacks.
- Produces:
  - required `afterAllocation: ReactNode` on `PaymentAllocationEditorProps`
  - `.payment-allocation-editor` grid with `outstanding`, `allocation`, `post`, and `advanced` areas
  - controlled `Additional payment details` disclosure that opens for values or errors

- [ ] **Step 1: Write failing component-order and workflow-hierarchy tests**

In `PaymentAllocationEditor.test.tsx`, add `afterAllocation` to `editorProps`:

```tsx
afterAllocation: <div aria-label="Balance and details">Balanced</div>,
```

Add:

```tsx
it('renders balance/details after allocation and before advanced options', () => {
  render(<PaymentAllocationEditor {...editorProps()} />)

  const editor = screen.getByTestId('payment-allocation-editor')
  const outstanding = within(editor).getByRole('heading', { name: 'Outstanding fees' }).closest('section')
  const allocation = within(editor).getByRole('heading', { name: 'Payment allocation' }).closest('section')
  const post = within(editor).getByLabelText('Balance and details')
  const advanced = within(editor).getByText('Advanced options').closest('details')

  expect(editor.children[0]).toBe(outstanding)
  expect(editor.children[1]).toBe(allocation)
  expect(editor.children[2]).toContainElement(post)
  expect(editor.children[3]).toBe(advanced)
})

it('keeps the one-time action available in an empty outstanding state', () => {
  render(<PaymentAllocationEditor {...editorProps({ outstandingCharges: [] })} />)

  expect(screen.getByText('No outstanding fees found for 2026.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add one-time charge' })).toBeInTheDocument()
})
```

In `App.test.tsx`, add:

```tsx
it('shows payment basics, fees, allocation, balance, then supporting details', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Create Payment' }))

  const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
  expect(dialog).toHaveClass('modal-frame--workflow')
  expect(within(dialog).getByRole('region', { name: 'Student context' })).toHaveTextContent(
    'Alyssa Tan',
  )
  expect(within(dialog).getByRole('heading', { name: 'Payment basics' })).toBeInTheDocument()
  expect(within(dialog).getByRole('heading', { name: 'Outstanding fees' })).toBeInTheDocument()
  expect(within(dialog).getByRole('heading', { name: 'Payment allocation' })).toBeInTheDocument()
  expect(within(dialog).getByText('Amount remaining')).toBeInTheDocument()
  expect(within(dialog).getByText('Additional payment details').closest('details')).not.toHaveAttribute('open')
  expect(within(dialog).getByRole('button', { name: 'Record Payment' })).toBeDisabled()
  await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveFocus())
})

it('opens Additional payment details when a contained field has an error', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/students/1/fee-record/outstanding')) {
      return json({ data: [outstandingUniformCharge] })
    }

    if (url.pathname.endsWith('/students/1/payments') && init?.method === 'POST') {
      return json(
        {
          message: 'Please check the payment.',
          errors: { reference_no: ['Reference is invalid.'] },
        },
        422,
      )
    }

    return installedImplementation(input, init)
  })

  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Create Payment' }))

  const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
  await user.type(within(dialog).getByLabelText('Amount'), '80')
  await user.type(
    await within(dialog).findByLabelText('Uniform – Sports T-shirt amount'),
    '80',
  )
  await user.click(within(dialog).getByText('Additional payment details'))
  await user.type(within(dialog).getByLabelText('Reference No'), 'INVALID')
  const recordButton = within(dialog).getByRole('button', { name: 'Record Payment' })
  expect(recordButton).toBeEnabled()
  await user.click(recordButton)

  const details = within(dialog).getByText('Additional payment details').closest('details')
  expect(await within(dialog).findByText('Reference is invalid.')).toBeInTheDocument()
  expect(details).toHaveAttribute('open')
  await waitFor(() => expect(within(dialog).getByLabelText('Reference No')).toHaveFocus())
})

it('preserves the Record Payment endpoint and allocation payload', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/students/1/fee-record/outstanding')) {
      return json({ data: [outstandingUniformCharge] })
    }

    if (url.pathname.endsWith('/students/1/payments') && init?.method === 'POST') {
      return json({ payment: { ...pendingPayment, amount: 80 } })
    }

    return installedImplementation(input, init)
  })

  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Create Payment' }))

  const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
  await user.type(within(dialog).getByLabelText('Amount'), '80')
  await user.type(
    await within(dialog).findByLabelText('Uniform – Sports T-shirt amount'),
    '80',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Record Payment' }))

  await waitFor(() => {
    const request = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/students/1/payments') && init?.method === 'POST',
    )
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      payment_method: 'bank_transfer',
      amount: 80,
      allocations: [
        {
          allocation_type: 'charge',
          fee_record_charge_id: 41,
          description: 'Uniform – Sports T-shirt',
          amount: 80,
        },
      ],
    })
  })
  expect(screen.queryByRole('dialog', { name: 'Record Payment' })).not.toBeInTheDocument()
  expect(screen.getByText('Payment recorded and pending finance verification.')).toBeInTheDocument()
})
```

The override delegates every unrelated request to `installedImplementation`, so the normal authenticated fixture remains intact.

- [ ] **Step 2: Run payment-focused tests and confirm failures**

```powershell
cd frontend
npm.cmd run test -- src/features/payments/PaymentAllocationEditor.test.tsx src/App.test.tsx -t "payment basics|balance/details|Additional payment details|empty outstanding|Record Payment endpoint"
```

Expected: FAIL because the slot, workflow headings, student context, disclosure, and initial focus do not exist.

- [ ] **Step 3: Add the ordered post-allocation slot**

Update imports and props:

```tsx
import { useMemo } from 'react'
import type { ReactNode } from 'react'

export type PaymentAllocationEditorProps = {
  academicYear: string
  paymentAmount: number
  allocationTotal: number
  allocations: PaymentAllocationDraft[]
  outstandingCharges: OutstandingChargeCell[]
  isLoadingOutstandingCharges: boolean
  outstandingChargeError: string
  allocationErrors?: ValidationErrors
  canAddOneTimeCharge: boolean
  isOneTimeChargeOpen: boolean
  oneTimeCharge: OneTimeChargeDraft
  oneTimeChargeErrors?: ValidationErrors
  oneTimeChargeNotice: string
  isSavingOneTimeCharge: boolean
  onRefresh: () => void
  onToggleCharge: (charge: OutstandingChargeCell, selected: boolean) => void
  onUpdateAllocation: (
    key: string,
    field: keyof Pick<PaymentAllocationDraft, 'description' | 'amount'>,
    value: string,
  ) => void
  onRemoveAllocation: (key: string) => void
  onOpenOneTimeCharge: () => void
  onCancelOneTimeCharge: () => void
  onUpdateOneTimeCharge: (field: keyof OneTimeChargeDraft, value: string) => void
  onCreateOneTimeCharge: () => void
  onAddUnclassified: () => void
  afterAllocation: ReactNode
}
```

Replace the returned fragment with `<div className="payment-allocation-editor" data-testid="payment-allocation-editor">`. Add `payment-outstanding-region` to the current Outstanding fees section, add `payment-allocation-region` to the current Payment allocation section, and insert `<div className="payment-post-allocation-region">{afterAllocation}</div>` immediately after Payment allocation and before the current Advanced options `<details>`. Do not change any child JSX, charge-selection callback, allocation callback, unclassified-payment behavior, or one-time-charge behavior.

- [ ] **Step 4: Derive explicit balance state and supporting-detail disclosure**

Inside App:

```tsx
const paymentAmountRef = useRef<HTMLInputElement>(null)
const paymentAdditionalErrorKeys = [
  'received_date',
  'paid_by',
  'bank_account',
  'reference_no',
  'payment_proof',
  'remark',
] as const
const paymentAdditionalHasError = paymentAdditionalErrorKeys.some(
  (key) => Boolean(paymentErrors?.[key]?.length),
)
const paymentAdditionalHasValue = [
  paymentForm.received_date,
  paymentForm.paid_by,
  paymentForm.bank_account,
  paymentForm.reference_no,
  paymentForm.payment_proof,
  paymentForm.remark,
].some((value) => value.trim() !== '')
const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false)

useEffect(() => {
  if (paymentAdditionalHasError || paymentAdditionalHasValue) {
    setPaymentDetailsOpen(true)
  }
}, [paymentAdditionalHasError, paymentAdditionalHasValue])

const paymentDifferenceCents = paymentAmountCents - allocationTotalCents
const paymentBalanceLabel =
  paymentDifferenceCents === 0
    ? 'Balanced'
    : paymentDifferenceCents > 0
      ? 'Amount remaining'
      : 'Over-allocated'
const paymentCanSubmit =
  paymentAmountCents > 0 &&
  paymentForm.allocations.length > 0 &&
  paymentDifferenceCents === 0 &&
  !hasIncompleteUnclassifiedAllocation(paymentForm.allocations)
```

Reset `paymentDetailsOpen` to `false` in `beginCreatePayment` before opening the dialog.

`StorePaymentRequest` currently makes only `received_date` conditionally required, and only for cash. Because cash Received Date stays in Payment basics, no field inside Additional details is method-required today. The value/error auto-open rules above therefore cover every current Additional field without inventing a frontend-only requirement.

- [ ] **Step 5: Replace the Record Payment body with the approved hierarchy**

Add the workflow props and remove `className="financial-modal"`:

```diff
 <ModalFrame
   title="Record Payment"
-  description="Record the payment details and choose which outstanding fees this payment should clear."
+  description="Record the amount, choose the fees it clears, and confirm the balance."
+  size="workflow"
+  initialFocusRef={paymentAmountRef}
-  className="financial-modal"
```

Update the footer submit guard:

```diff
 <button
   className="primary-action compact"
   type="submit"
   form="payment-record-form"
-  disabled={isSavingPayment}
+  disabled={isSavingPayment || !paymentCanSubmit}
 >
```

Insert this context and basics section at the start of `payment-record-form`, replacing the current `.payment-form-state` and top `.form-grid`:

```tsx
<ModalContextSummary
  ariaLabel="Student context"
  items={[
    { label: 'Student', value: selectedStudent?.full_name ?? 'Not selected' },
    { label: 'Student ID', value: selectedStudent?.student_no ?? 'Not recorded' },
    {
      label: 'Status on save',
      value: paymentForm.payment_method === 'cash' ? 'Verified' : 'Pending verification',
    },
  ]}
/>

<section className="payment-basics" aria-labelledby="payment-basics-heading">
  <div className="payment-subheader">
    <div>
      <p className="eyebrow">Step 1</p>
      <h3 id="payment-basics-heading">Payment basics</h3>
    </div>
  </div>
  <div className="payment-basics-grid">
    <label className="form-field">
      Academic Year
      <input
        value={paymentForm.academic_year}
        onChange={(event) => updatePaymentForm('academic_year', event.target.value)}
      />
    </label>
    <label className="form-field">
      Payment Method
      <select
        value={paymentForm.payment_method}
        onChange={(event) => updatePaymentForm('payment_method', event.target.value)}
      >
        {paymentMethodOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
    <label className="form-field">
      Amount
      <input
        ref={paymentAmountRef}
        aria-label="Amount"
        type="number"
        min="0.01"
        step="0.01"
        value={paymentForm.amount}
        onChange={(event) => updatePaymentForm('amount', event.target.value)}
      />
    </label>
    <label className="form-field">
      Payment Date
      <input
        type="date"
        value={paymentForm.payment_date}
        onChange={(event) => updatePaymentForm('payment_date', event.target.value)}
      />
    </label>
    {paymentForm.payment_method === 'cash' && (
      <label className="form-field">
        Received Date
        <input
          type="date"
          value={paymentForm.received_date}
          onChange={(event) => updatePaymentForm('received_date', event.target.value)}
        />
      </label>
    )}
  </div>
</section>
```

Define the post-allocation content before the return:

```tsx
const paymentPostAllocation = (
  <div className="payment-post-allocation">
    <section
      className={`payment-balance-summary payment-balance-summary--${paymentBalanceLabel
        .toLowerCase()
        .replace(' ', '-')}`}
      aria-live="polite"
      aria-label="Payment balance"
    >
      <span>Payment {formatCurrency(Number(paymentForm.amount || 0))}</span>
      <span>Allocation {formatCurrency(paymentAllocationTotal)}</span>
      <strong>{paymentBalanceLabel}</strong>
      {paymentDifferenceCents !== 0 && (
        <small>{formatCurrency(Math.abs(paymentDifferenceCents) / 100)}</small>
      )}
    </section>

    <details
      className="payment-additional-details"
      open={paymentDetailsOpen}
      onToggle={(event) => setPaymentDetailsOpen(event.currentTarget.open)}
    >
      <summary>Additional payment details</summary>
      <div className="payment-additional-grid">
        {paymentForm.payment_method !== 'cash' && (
          <label className="form-field">
            Received Date
            <input
              type="date"
              value={paymentForm.received_date}
              onChange={(event) => updatePaymentForm('received_date', event.target.value)}
            />
          </label>
        )}
        <label className="form-field">
          Paid By
          <input value={paymentForm.paid_by} onChange={(event) => updatePaymentForm('paid_by', event.target.value)} />
        </label>
        <label className="form-field">
          Bank Account
          <input value={paymentForm.bank_account} onChange={(event) => updatePaymentForm('bank_account', event.target.value)} />
        </label>
        <label className="form-field">
          Reference No
          <input value={paymentForm.reference_no} onChange={(event) => updatePaymentForm('reference_no', event.target.value)} />
        </label>
        <label className="form-field wide">
          Payment Proof Text / Reference
          <textarea value={paymentForm.payment_proof} onChange={(event) => updatePaymentForm('payment_proof', event.target.value)} />
        </label>
        <label className="form-field wide">
          Remark
          <textarea value={paymentForm.remark} onChange={(event) => updatePaymentForm('remark', event.target.value)} />
        </label>
      </div>
    </details>
  </div>
)
```

Add `afterAllocation={paymentPostAllocation}` to the current `PaymentAllocationEditor` call. Remove the old `.payment-submit-area`. Move each existing supporting field rather than duplicating it; Task 8 restores its validation markup with shared helpers.

- [ ] **Step 6: Implement the PC two-area and iPad ordered composition**

```css
.payment-form,
.payment-basics,
.payment-post-allocation {
  display: grid;
  gap: 16px;
}

.payment-basics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.payment-allocation-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-areas:
    "outstanding post"
    "allocation post"
    "advanced post";
  gap: 16px 20px;
  align-items: start;
}

.payment-outstanding-region { grid-area: outstanding; }
.payment-allocation-region { grid-area: allocation; }
.payment-post-allocation-region {
  grid-area: post;
  position: sticky;
  top: 0;
}
.payment-advanced-options { grid-area: advanced; }

.payment-additional-details > summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 800;
}

.payment-additional-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 12px;
}

@media screen and (max-width: 1023px) {
  .payment-basics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payment-allocation-editor {
    grid-template-columns: 1fr;
    grid-template-areas:
      "outstanding"
      "allocation"
      "post"
      "advanced";
  }

  .payment-post-allocation-region {
    position: static;
  }
}

@media screen and (max-width: 767px) {
  .payment-basics-grid,
  .payment-additional-grid {
    grid-template-columns: 1fr;
  }
}
```

Delete the `.financial-modal` width declaration after both workflow dialogs have migrated.

- [ ] **Step 7: Run payment tests, full App tests, lint, and build**

```powershell
cd frontend
npm.cmd run test -- src/features/payments/PaymentAllocationEditor.test.tsx src/App.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: one-time charge creation, allocation totals, unclassified-payment guard, payment payload, and permissions still pass. The new details-error test must focus Reference No after the section opens.

- [ ] **Step 8: Commit Record Payment**

```powershell
git add frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx frontend/src/features/payments/PaymentAllocationEditor.tsx frontend/src/features/payments/PaymentAllocationEditor.test.tsx
git commit -m "feat: prioritize payment allocation workflow"
```

### Task 7: Add accurate Verify, Void Payment, and Void Receipt context

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `StudentPayment`, `StudentReceipt`, `ModalContextSummary`, `ModalFrame`, and the existing payment/receipt arrays.
- Produces: selected payment/receipt derivations, standard Verify summary, compact danger summaries, and issued-receipt blocking state.

- [ ] **Step 1: Write failing summary, consequence, focus, and guard tests**

Add the finance-only fixture beside `schoolAdminDialogUser`:

```tsx
const financeDialogUser = {
  ...currentUser,
  roles: ['finance'],
  permissions: [
    'students.view',
    'fee_record.view',
    'payments.view',
    'payments.verify',
    'payments.void',
    'receipts.view',
    'receipts.void',
  ],
}
```

Use it for every confirmation test:

```tsx
it('shows the selected payment before verification', async () => {
  const user = userEvent.setup()
  installApiUser(financeDialogUser)
  await openSelectedStudentPayments(user)
  await user.click(await screen.findByRole('button', { name: 'Verify' }))

  const dialog = screen.getByRole('dialog', { name: 'Verify Payment' })
  expect(dialog).toHaveClass('modal-frame--standard')
  expect(within(dialog).getByRole('region', { name: 'Payment to verify' })).toHaveTextContent(
    'Alyssa Tan',
  )
  expect(within(dialog).getByRole('region', { name: 'Payment to verify' })).toHaveTextContent(
    'RM 400',
  )
  expect(within(dialog).getByRole('region', { name: 'Payment to verify' })).toHaveTextContent(
    'PAY-11',
  )
  await waitFor(() => expect(within(dialog).getByLabelText('Received Date')).toHaveFocus())
})

it.each([
  [
    'pending_verification',
    'This pending payment will become void; charge balances have not yet changed.',
  ],
  [
    'verified',
    'Each applied charge will reopen by the amount allocated from this payment.',
  ],
])('explains the %s payment void consequence', async (status, consequence) => {
  const user = userEvent.setup()
  installApiUser(financeDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/students/1/payments') && init?.method !== 'POST') {
      return json({ data: [{ ...pendingPayment, status }] })
    }

    return installedImplementation(input, init)
  })

  await openSelectedStudentPayments(user)
  await user.click(await screen.findByRole('button', { name: 'Void' }))

  const dialog = screen.getByRole('dialog', { name: 'Void Payment' })
  expect(within(dialog).getByRole('region', { name: 'Payment to void' })).toHaveTextContent(
    consequence,
  )
  expect(
    within(dialog).getByRole('button', { name: 'Confirm Void Payment' }),
  ).toBeEnabled()
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
})

it('blocks payment void while an issued receipt exists', async () => {
  const user = userEvent.setup()
  installApiUser(financeDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/students/1/payments') && init?.method !== 'POST') {
      return json({
        data: [
          {
            ...pendingPayment,
            issued_receipt: {
              id: 21,
              receipt_no: 'RCP-21',
              receipt_date: '2026-07-17',
              status: 'issued',
            },
          },
        ],
      })
    }

    return installedImplementation(input, init)
  })

  await openSelectedStudentPayments(user)
  await user.click(await screen.findByRole('button', { name: 'Void' }))

  const dialog = screen.getByRole('dialog', { name: 'Void Payment' })
  expect(dialog).toHaveClass('modal-frame--compact', 'modal-frame--danger')
  expect(within(dialog).getByText('Void the issued receipt before voiding this payment.')).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Confirm Void Payment' })).not.toBeInTheDocument()
  expect(within(dialog).queryByLabelText('Void Reason')).not.toBeInTheDocument()
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus())
})

it('explains that voiding a receipt leaves payment and balances unchanged', async () => {
  const user = userEvent.setup()
  installApiUser(financeDialogUser)
  await openSelectedStudentPayments(user)
  await user.click(screen.getAllByRole('button', { name: 'Void' }).at(-1)!)

  const dialog = screen.getByRole('dialog', { name: 'Void Receipt' })
  const summary = within(dialog).getByRole('region', { name: 'Receipt to void' })
  expect(summary).toHaveTextContent('RCP-21')
  expect(summary).toHaveTextContent('Alyssa Tan')
  expect(summary).toHaveTextContent('The linked payment remains verified')
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
})

it('preserves Verify Payment submission and success refresh behavior', async () => {
  const user = userEvent.setup()
  installApiUser(financeDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/payments/11/verify') && init?.method === 'POST') {
      return json({ payment: { ...pendingPayment, status: 'verified' } })
    }
    return installedImplementation(input, init)
  })

  await openSelectedStudentPayments(user)
  await user.click(await screen.findByRole('button', { name: 'Verify' }))
  const dialog = screen.getByRole('dialog', { name: 'Verify Payment' })
  const receivedDate = within(dialog).getByLabelText('Received Date')
  await user.clear(receivedDate)
  await user.type(receivedDate, '2026-07-18')
  await user.type(within(dialog).getByLabelText('Bank Account'), 'Maybank')
  await user.click(within(dialog).getByRole('button', { name: 'Verify Payment' }))

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/payments\/11\/verify$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          received_date: '2026-07-18',
          bank_account: 'Maybank',
          reference_no: 'PAY-11',
          remark: null,
        }),
      }),
    )
  })
  expect(screen.queryByRole('dialog', { name: 'Verify Payment' })).not.toBeInTheDocument()
  expect(screen.getByText('Payment verified.')).toBeInTheDocument()
})

it('preserves eligible Void Payment submission and reason', async () => {
  const user = userEvent.setup()
  installApiUser(financeDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/payments/11/void') && init?.method === 'POST') {
      return json({ payment: { ...pendingPayment, status: 'voided' } })
    }
    return installedImplementation(input, init)
  })

  await openSelectedStudentPayments(user)
  await user.click(await screen.findByRole('button', { name: 'Void' }))
  const dialog = screen.getByRole('dialog', { name: 'Void Payment' })
  await user.type(within(dialog).getByLabelText('Void Reason'), 'Duplicate entry')
  await user.click(within(dialog).getByRole('button', { name: 'Confirm Void Payment' }))

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/payments\/11\/void$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ void_reason: 'Duplicate entry' }),
      }),
    )
  })
  expect(screen.getByText('Payment voided.')).toBeInTheDocument()
})

it('preserves Void Receipt submission while leaving payment handling separate', async () => {
  const user = userEvent.setup()
  installApiUser(financeDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/receipts/21/void') && init?.method === 'POST') {
      return json({ receipt: { ...issuedReceipt, status: 'voided' } })
    }
    return installedImplementation(input, init)
  })

  await openSelectedStudentPayments(user)
  await user.click(screen.getAllByRole('button', { name: 'Void' }).at(-1)!)
  const dialog = screen.getByRole('dialog', { name: 'Void Receipt' })
  await user.type(within(dialog).getByLabelText('Void Reason'), 'Receipt reissued')
  await user.click(within(dialog).getByRole('button', { name: 'Confirm Void Receipt' }))

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/receipts\/21\/void$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ void_reason: 'Receipt reissued' }),
      }),
    )
  })
  expect(screen.getByText('Receipt RCP-21 voided.')).toBeInTheDocument()
})
```

Add a local test helper that performs the existing navigation:

```tsx
async function openSelectedStudentPayments(
  user: ReturnType<typeof userEvent.setup>,
) {
  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
}
```

The helper receives the test's single `userEvent` instance, so navigation and later interaction share one event queue.

- [ ] **Step 2: Run confirmation-focused tests and confirm failures**

```powershell
cd frontend
npm.cmd run test -- src/App.test.tsx -t "selected payment|payment void consequence|blocks payment void|voiding a receipt|submission"
```

Expected: FAIL because current dialogs contain only fields, use default sizes/tones, and allow a known backend-rejected payment void.

- [ ] **Step 3: Derive the active records and focus refs**

```tsx
const paymentToVerify =
  verifyingPaymentId === null ? null : payments.find((payment) => payment.id === verifyingPaymentId) ?? null
const paymentToVoid =
  voidingPaymentId === null ? null : payments.find((payment) => payment.id === voidingPaymentId) ?? null
const receiptToVoid =
  voidingReceiptId === null ? null : receipts.find((receipt) => receipt.id === voidingReceiptId) ?? null
const paymentVoidBlocked = paymentToVoid?.issued_receipt?.status === 'issued'

const verifyReceivedDateRef = useRef<HTMLInputElement>(null)
const voidPaymentCancelRef = useRef<HTMLButtonElement>(null)
const voidReceiptCancelRef = useRef<HTMLButtonElement>(null)
```

Keep the ID states as the submission source of truth; derived records are presentation context only.

- [ ] **Step 4: Build Verify Payment from the selected record**

Define the footer alongside the other dialog derivations:

```tsx
const verifyFooter = (
  <>
    <button
      type="button"
      className="secondary-action"
      onClick={() => setVerifyingPaymentId(null)}
    >
      Cancel
    </button>
    <button
      className="primary-action compact"
      type="submit"
      form="verify-payment-form"
      disabled={isVerifyingPayment}
    >
      {isVerifyingPayment ? 'Verifying...' : 'Verify Payment'}
    </button>
  </>
)
```

Replace the current Verify Payment dialog with:

```tsx
{paymentToVerify && (
  <ModalFrame
    title="Verify Payment"
    description="Confirm the received details before verification."
    size="standard"
    initialFocusRef={verifyReceivedDateRef}
    onClose={() => setVerifyingPaymentId(null)}
    footer={verifyFooter}
  >
    <ModalContextSummary
      ariaLabel="Payment to verify"
      items={[
        { label: 'Student', value: `${selectedStudent?.full_name} / ${selectedStudent?.student_no}` },
        { label: 'Amount', value: formatCurrency(paymentToVerify.amount) },
        { label: 'Method', value: formatStatus(paymentToVerify.payment_method) },
        { label: 'Payment date', value: paymentToVerify.payment_date },
        { label: 'Reference', value: paymentToVerify.reference_no ?? 'Not recorded' },
        { label: 'Status', value: formatStatus(paymentToVerify.status) },
      ]}
    />
    <form id="verify-payment-form" className="form-grid inline-payment-form" onSubmit={(event) => submitVerifyPayment(event, paymentToVerify.id)}>
      <label className="form-field">
        Received Date
        <input
          ref={verifyReceivedDateRef}
          type="date"
          value={verifyForm.received_date}
          onChange={(event) => setVerifyForm((current) => ({ ...current, received_date: event.target.value }))}
        />
        {formatValidationError(verifyErrors, 'received_date') && (
          <small>{formatValidationError(verifyErrors, 'received_date')}</small>
        )}
      </label>
      <label className="form-field">
        Bank Account
        <input
          value={verifyForm.bank_account}
          onChange={(event) => setVerifyForm((current) => ({ ...current, bank_account: event.target.value }))}
        />
      </label>
      <label className="form-field">
        Reference No
        <input
          value={verifyForm.reference_no}
          onChange={(event) => setVerifyForm((current) => ({ ...current, reference_no: event.target.value }))}
        />
      </label>
      <label className="form-field wide">
        Remark
        <textarea
          value={verifyForm.remark}
          onChange={(event) => setVerifyForm((current) => ({ ...current, remark: event.target.value }))}
        />
        {formatValidationError(verifyErrors, 'payment') && (
          <small>{formatValidationError(verifyErrors, 'payment')}</small>
        )}
      </label>
    </form>
  </ModalFrame>
)}
```

Task 8 replaces the two `<small>` elements with associated `FieldError` components without changing the form payload.

- [ ] **Step 5: Build eligible and blocked Void Payment states**

```tsx
{paymentToVoid && (
  <ModalFrame
    title="Void Payment"
    description={
      paymentVoidBlocked
        ? 'This payment cannot be voided while its receipt is issued.'
        : 'Review the consequence and record a reason.'
    }
    size="compact"
    tone="danger"
    initialFocusRef={voidPaymentCancelRef}
    onClose={() => setVoidingPaymentId(null)}
    footer={
      paymentVoidBlocked ? (
        <button
          ref={voidPaymentCancelRef}
          type="button"
          className="secondary-action"
          onClick={() => setVoidingPaymentId(null)}
        >
          Close
        </button>
      ) : (
        <>
          <button
            ref={voidPaymentCancelRef}
            type="button"
            className="secondary-action"
            onClick={() => setVoidingPaymentId(null)}
          >
            Cancel
          </button>
          <button
            className="primary-action compact modal-danger-action"
            type="submit"
            form="void-payment-form"
            disabled={isVoidingPayment}
          >
            {isVoidingPayment ? 'Voiding...' : 'Confirm Void Payment'}
          </button>
        </>
      )
    }
  >
    <ModalContextSummary
      ariaLabel="Payment to void"
      tone="danger"
      items={[
        { label: 'Student', value: `${selectedStudent?.full_name} / ${selectedStudent?.student_no}` },
        { label: 'Amount', value: formatCurrency(paymentToVoid.amount) },
        { label: 'Method', value: formatStatus(paymentToVoid.payment_method) },
        { label: 'Payment date', value: paymentToVoid.payment_date },
        { label: 'Status', value: formatStatus(paymentToVoid.status) },
        {
          label: 'Receipt',
          value: paymentToVoid.issued_receipt?.receipt_no ?? 'No issued receipt',
        },
      ]}
      consequence={
        paymentVoidBlocked
          ? 'Void the issued receipt before voiding this payment.'
          : paymentToVoid.status === 'verified'
            ? 'Each applied charge will reopen by the amount allocated from this payment.'
            : 'This pending payment will become void; charge balances have not yet changed.'
      }
    />
    {!paymentVoidBlocked && (
      <form
        id="void-payment-form"
        className="inline-payment-form"
        onSubmit={(event) => submitVoidPayment(event, paymentToVoid.id)}
      >
        <label className="form-field wide">
          Void Reason
          <textarea
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
          {formatValidationError(voidErrors, 'void_reason') && (
            <small>{formatValidationError(voidErrors, 'void_reason')}</small>
          )}
          {formatValidationError(voidErrors, 'payment') && (
            <small>{formatValidationError(voidErrors, 'payment')}</small>
          )}
        </label>
      </form>
    )}
  </ModalFrame>
)}
```

- [ ] **Step 6: Build accurate Void Receipt context**

Define the receipt footer alongside the other dialog derivations:

```tsx
const voidReceiptFooter = (
  <>
    <button
      ref={voidReceiptCancelRef}
      type="button"
      className="secondary-action"
      onClick={() => setVoidingReceiptId(null)}
    >
      Cancel
    </button>
    <button
      className="primary-action compact modal-danger-action"
      type="submit"
      form="void-receipt-form"
      disabled={isVoidingReceipt}
    >
      {isVoidingReceipt ? 'Voiding...' : 'Confirm Void Receipt'}
    </button>
  </>
)
```

Replace the current Void Receipt dialog with:

```tsx
{receiptToVoid && (
  <ModalFrame
    title="Void Receipt"
    description="Review the receipt and record a reason."
    size="compact"
    tone="danger"
    initialFocusRef={voidReceiptCancelRef}
    onClose={() => setVoidingReceiptId(null)}
    footer={voidReceiptFooter}
  >
    <ModalContextSummary
      ariaLabel="Receipt to void"
      tone="danger"
      items={[
        { label: 'Receipt', value: receiptToVoid.receipt_no },
        { label: 'Student', value: `${receiptToVoid.student_name} / ${receiptToVoid.student_no}` },
        { label: 'Receipt date', value: receiptToVoid.receipt_date },
        { label: 'Amount', value: formatCurrency(receiptToVoid.amount) },
        { label: 'Payment reference', value: payments.find((payment) => payment.id === receiptToVoid.payment_id)?.reference_no ?? 'Not recorded' },
      ]}
      consequence="The receipt number will not be reused. The linked payment remains verified and balances do not change until the payment is separately voided."
    />
    <form
      id="void-receipt-form"
      className="inline-payment-form"
      onSubmit={(event) => submitVoidReceipt(event, receiptToVoid.id)}
    >
      <label className="form-field wide">
        Void Reason
        <textarea
          value={receiptVoidReason}
          onChange={(event) => setReceiptVoidReason(event.target.value)}
        />
        {formatValidationError(receiptVoidErrors, 'void_reason') && (
          <small>{formatValidationError(receiptVoidErrors, 'void_reason')}</small>
        )}
        {formatValidationError(receiptVoidErrors, 'receipt') && (
          <small>{formatValidationError(receiptVoidErrors, 'receipt')}</small>
        )}
      </label>
    </form>
  </ModalFrame>
)}
```

Task 8 replaces the Void Payment and Void Receipt `<small>` elements with associated `FieldError` components while preserving both submit payloads.

- [ ] **Step 7: Add the distinct danger action style**

```css
.modal-danger-action {
  background: var(--brand-red-dark, #b31923);
  color: #ffffff;
  box-shadow: none;
}

.modal-danger-action:focus-visible {
  outline-color: #7f1119;
}
```

Danger meaning remains written in the summary; color is never the only cue.

- [ ] **Step 8: Run all App tests, lint, build, and commit**

```powershell
cd frontend
npm.cmd run test -- src/App.test.tsx
npm.cmd run lint
npm.cmd run build
cd ..
git add frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx
git commit -m "feat: add safe financial confirmations"
```

Expected: no void request is sent from the blocked state; eligible pending/verified payment and receipt submissions retain existing endpoints and payloads.

### Task 8: Finish field-error association and failure focus

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/CalendarPage.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeAgreementEditor.tsx`
- Modify: `frontend/src/features/fee-agreements/FeeItemRow.tsx`
- Modify: `frontend/src/features/payments/PaymentAllocationEditor.tsx`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/src/components/CalendarPage.test.tsx`
- Test: `frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx`
- Test: `frontend/src/features/payments/PaymentAllocationEditor.test.tsx`

**Interfaces:**
- Consumes: `FieldError`, `fieldErrorProps`, and `focusFirstDialogError` from Tasks 1–2.
- Produces: stable error IDs, programmatic error association, preserved input, automatic disclosure opening, and first-error focus for every modal form.

Use these exact ID prefixes:

| Dialog | Error ID prefix |
| --- | --- |
| Create Student | `create-student-` |
| One-time Charge | `one-time-charge-` |
| Fee Agreement | `fee-agreement-` |
| Record Payment | `record-payment-` |
| Inline payment one-time charge | `payment-one-time-` |
| Verify Payment | `verify-payment-` |
| Void Payment | `void-payment-` |
| Void Receipt | `void-receipt-` |
| Calendar | `calendar-` |

- [ ] **Step 1: Add failing tests for association, disclosure, preservation, and focus**

Add one representative assertion per dialog family rather than duplicating every field:

```tsx
it('associates and focuses the first Create Student server error', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/students') && init?.method === 'POST') {
      return json(
        {
          message: 'Please check the student.',
          errors: { student_no: ['Student ID is required.'] },
        },
        422,
      )
    }

    return installedImplementation(input, init)
  })

  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Add Student' }))
  await user.type(screen.getByLabelText('Student ID'), 'TEMP-001')
  await user.type(screen.getByLabelText('Student Name'), 'Alyssa Tan')
  await user.selectOptions(screen.getByLabelText('Class'), '2')
  await user.click(screen.getByRole('button', { name: 'Create Student' }))

  const studentId = await screen.findByLabelText('Student ID')
  expect(studentId).toHaveAttribute('aria-invalid', 'true')
  expect(studentId).toHaveAttribute('aria-describedby', 'create-student-student-no-error')
  expect(document.getElementById('create-student-student-no-error')).toHaveTextContent(
    'Student ID is required.',
  )
  await waitFor(() => expect(studentId).toHaveFocus())
})

it('keeps Record Payment values while focusing an error inside Additional details', async () => {
  const user = userEvent.setup()
  installApiUser(schoolAdminDialogUser)
  const fetchMock = vi.mocked(globalThis.fetch)
  const installedImplementation = fetchMock.getMockImplementation()

  if (!installedImplementation) throw new Error('API mock is not installed')

  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input))

    if (url.pathname.endsWith('/students/1/fee-record/outstanding')) {
      return json({ data: [outstandingUniformCharge] })
    }

    if (url.pathname.endsWith('/students/1/payments') && init?.method === 'POST') {
      return json(
        {
          message: 'Please check the payment.',
          errors: { reference_no: ['Reference is invalid.'] },
        },
        422,
      )
    }

    return installedImplementation(input, init)
  })

  await renderAuthenticatedApp()
  await user.click(screen.getByRole('button', { name: 'Students' }))
  await user.click(await screen.findByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Create Payment' }))

  const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
  const amount = within(dialog).getByLabelText('Amount')
  await user.type(amount, '80')
  await user.type(
    await within(dialog).findByLabelText('Uniform – Sports T-shirt amount'),
    '80',
  )
  await user.click(within(dialog).getByText('Additional payment details'))
  await user.type(within(dialog).getByLabelText('Reference No'), 'INVALID')
  await user.click(within(dialog).getByRole('button', { name: 'Record Payment' }))

  const reference = await within(dialog).findByLabelText('Reference No')
  expect(amount).toHaveValue(80)
  expect(reference).toHaveAttribute('aria-describedby', 'record-payment-reference-no-error')
  expect(within(dialog).getByText('Additional payment details').closest('details')).toHaveAttribute('open')
  await waitFor(() => expect(reference).toHaveFocus())
})
```

Add to Calendar tests:

```tsx
expect(screen.getByLabelText('Title')).toHaveAttribute(
  'aria-describedby',
  'calendar-title-error',
)
await waitFor(() => expect(screen.getByLabelText('Title')).toHaveFocus())
```

Add to Fee Agreement tests:

```tsx
expect(screen.getByLabelText('Tuition Fee Billing Pattern')).toHaveAttribute(
  'aria-invalid',
  'true',
)
expect(screen.getByText('Choose at least one billing month.')).toHaveAttribute(
  'id',
  'fee-agreement-item-1-billing-months-error',
)
```

Add to PaymentAllocationEditor tests:

```tsx
const amount = screen.getByLabelText('Unclassified payment 1 amount')
expect(amount).toHaveAttribute('aria-describedby', 'record-payment-allocation-0-amount-error')
```

- [ ] **Step 2: Run the four focused test files and confirm association failures**

```powershell
cd frontend
npm.cmd run test -- src/App.test.tsx src/components/CalendarPage.test.tsx src/features/fee-agreements/FeeAgreementEditor.test.tsx src/features/payments/PaymentAllocationEditor.test.tsx
```

Expected: FAIL where error text has no ID/association and where server errors do not move focus after rendering.

- [ ] **Step 3: Replace ad-hoc error markup with the shared helpers**

Use the following exact pattern for every mapped field:

```tsx
const studentNumberError = formatValidationError(formErrors, 'student_no')

<input
  ref={createStudentIdRef}
  value={form.student_no}
  onChange={(event) => updateForm('student_no', event.target.value)}
  {...fieldErrorProps('create-student-student-no-error', studentNumberError)}
/>
<FieldError
  id="create-student-student-no-error"
  message={studentNumberError}
/>
```

Apply it to these exact keys:

- Create Student: `student_no`, `full_name`, `level_group`, `class_id`.
- One-time Charge: `academic_year`, `billing_month`, `fee_record_category`, `expected_amount`, `description`.
- Fee Agreement: `academic_year`, `effective_from`, `items.{index}.billing_months`, `discounts.0.discount_label`, `discounts.0.value`.
- Record Payment: `payment_date`, `received_date`, `amount`, `paid_by`, `bank_account`, `reference_no`, `payment_proof`, `remark`, `allocations`.
- Inline payment one-time charge: `billing_month`, `fee_record_category`, `description`, `expected_amount`.
- Verify Payment: `received_date`, `payment`.
- Void Payment: `void_reason`, `payment`.
- Void Receipt: `void_reason`, `receipt`.
- Calendar: `title`, `event_type`, `is_all_day`, `start_date`, `start_time`, `starts_at`, `end_date`, `ends_at`, `location`, `participants`, `notes`.

For controls that can receive two server keys, combine the visible text before passing it:

```tsx
const startDateError = [
  ...(fieldErrors.start_date ?? []),
  ...(fieldErrors.starts_at ?? []),
].join(' ')

<input
  type="date"
  name="start_date"
  value={form.start_date}
  onChange={(event) => updateForm('start_date', event.target.value)}
  {...fieldErrorProps('calendar-start-date-error', startDateError || undefined)}
/>
<FieldError id="calendar-start-date-error" message={startDateError || undefined} />
```

Do not render the same message twice.

- [ ] **Step 4: Give dialog-level errors a focus target**

Use this structure for `payment`, `receipt`, items-level, and Calendar form errors that do not map to a single field:

```tsx
{dialogError && (
  <div className="inline-error" role="alert" tabIndex={-1}>
    {dialogError}
  </div>
)}
```

When a server response has both a field error and a dialog-level message, render the field error first in DOM order only if the field is the intended recovery target. Otherwise render the dialog-level alert before the affected section.

- [ ] **Step 5: Trigger focus after each recoverable validation failure**

Call the helper immediately after setting validation state; its animation-frame delay waits for React to render:

```tsx
if (error instanceof ApiError && error.status === 422) {
  setPaymentErrors(error.errors)
  focusFirstDialogError()
}
```

Add the same call after these state updates:

```tsx
setFormErrors(error.errors)
setFeeAgreementErrors(error.errors)
setManualChargeErrors(error.errors)
setPaymentOneTimeChargeErrors(error.errors)
setVerifyErrors(error.errors)
setVoidErrors(error.errors)
setReceiptVoidErrors(error.errors)
setFieldErrors(localErrors)
setFieldErrors(error.errors)
```

For Fee Agreement, keep its more specific fee-row and discount focus effect. Call `focusFirstDialogError()` only when the first error key is not an `items.{index}.` or `discounts.` key.

- [ ] **Step 6: Guarantee collapsed sections open before focus**

Keep the Task 6 `paymentAdditionalHasError` effect. Ensure the one-time charge panel remains open when `paymentOneTimeChargeErrors` is set. Keep Fee Agreement's existing item/discount expansion effect. No other modal contains a collapsible error region.

Add this assertion to the one-time charge validation test:

```tsx
expect(screen.getByRole('heading', { name: 'Add one-time charge' })).toBeInTheDocument()
expect(screen.getByLabelText('One-time charge description')).toHaveFocus()
```

- [ ] **Step 7: Run tests, lint, build, and commit**

```powershell
cd frontend
npm.cmd run test -- src/App.test.tsx src/components/CalendarPage.test.tsx src/features/fee-agreements/FeeAgreementEditor.test.tsx src/features/payments/PaymentAllocationEditor.test.tsx
npm.cmd run lint
npm.cmd run build
cd ..
git add frontend/src/App.tsx frontend/src/components/CalendarPage.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.tsx frontend/src/features/fee-agreements/FeeItemRow.tsx frontend/src/features/payments/PaymentAllocationEditor.tsx frontend/src/App.test.tsx frontend/src/components/CalendarPage.test.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx frontend/src/features/payments/PaymentAllocationEditor.test.tsx
git commit -m "fix: make modal errors recoverable"
```

Expected: every modal preserves entered values, associates visible error text, opens any containing disclosure, scrolls the first problem into view, and keeps page scroll fixed.

## Planned Test Coverage and Failure Modes

```text
CODE PATHS                                      USER FLOWS
[PLAN ★★★] ModalFrame                           [PLAN ★★★] Standard forms
  |-- portal + semantics                          |-- Create Student / One-time Charge
  |-- initial/default focus                       |-- first focus + role permission
  |-- Tab / Shift+Tab / Escape                    `-- submit loading + field recovery
  |-- inert + scroll lock + cleanup
  |-- non-closing backdrop                      [PLAN ★★★] Workflow forms
  `-- top/bottom overflow cues                    |-- Fee Agreement create/supersede
                                                   |-- Record Payment empty/load/error
[PLAN ★★★] Shared context/errors                  |-- mismatch -> balanced -> submit
  |-- neutral/danger definition list              `-- hidden details value/error reopen
  |-- consequence text
  |-- error present/absent                       [PLAN ★★★] Confirmations
  `-- aria-invalid/describedby                     |-- Verify pending payment
                                                   |-- Void pending / verified / blocked
[PLAN ★★★] Dialog migrations                      `-- Void Receipt target/consequence
  |-- explicit compact/standard/workflow
  |-- PC/iPad/phone CSS branches                [PLAN ★★★] Calendar
  |-- danger/default tone                         |-- Add / Edit / View
  `-- role-specific inventory                     |-- Delete cancel / Escape / failure
                                                   `-- validation association + focus

AUTOMATED GATE: focused tests + full Vitest + lint + build + diff check
VISUAL GATE: 1440x900 + 1180x820 + 820x1180 + 390x844 + 200% zoom
DEVICE GATE: physical iPad limitations stated explicitly when unavailable
```

| Production failure mode | Planned protection | User-visible result |
| --- | --- | --- |
| Portal unmount leaves the page inert or scroll-locked | Task 1 restores prior root/body values and tests both absent and pre-existing inert states | Page is usable and trigger focus returns |
| Dynamic content changes while the body is already scrolled | Resize/Mutation observers recompute cues; scroll-edge state updates only on edge changes | Header/footer shadows accurately indicate more content |
| Long context, receipt numbers, or server errors overflow | `minmax(0, 1fr)`, `min-width: 0`, wrapping CSS, 200% zoom and long-content checks | Values wrap without covering Close or actions |
| A recoverable 422 error renders below the fold | Task 8 associates the error, opens its disclosure, focuses and scrolls the first target | Entered values remain and the next correction is visible |
| Outstanding-fee refresh is empty or fails | Existing editor states remain; Task 6 order tests keep Refresh and One-time Charge access reachable | User sees a clear empty/error state and a recovery action |
| Payment amount and allocations differ | `paymentCanSubmit` disables Record Payment and the balance summary names the difference | User sees `Amount remaining` or `Over-allocated` before submission |
| A stale payment already has an issued receipt | Task 7 derives the selected record and removes the payment-void form/action | User sees the receipt number and the required next step |
| Calendar delete fails after an unsaved edit | Existing Calendar regression tests retain the event, confirmation, and caller state | Error remains in the danger dialog; the event is not silently removed |
| The viewport shrinks or iPad safe areas reduce space | Portal uses `100dvh`, safe-area padding, explicit size constraints, internal body scroll | Close, fields, scrollbar, focus rings, and footer remain reachable |

No planned failure mode is both silent and missing test/error handling. The physical-iPad-only behaviors remain an explicit verification limitation rather than an automated claim.

### Task 9: Run the full regression and visual acceptance matrix

**Files:**
- Modify only if a verification failure requires a scoped fix: files already listed in Tasks 1–8.
- Evidence output: `C:\Users\chong\.codex\visualizations\2026\07\28\019fa6b8-0717-7852-8b4d-e5a91e734f14\responsive-modal-ui\`

**Interfaces:**
- Consumes: all completed task commits.
- Produces: passing automated checks, accepted PC/iPad/phone screenshots, keyboard/zoom evidence, and a documented real-device limitation.

- [ ] **Step 1: Run all automated frontend checks from a clean task state**

```powershell
cd frontend
npm.cmd run test
npm.cmd run lint
npm.cmd run build
cd ..
git diff --check
git status --short
```

Expected:

- Vitest exits 0 with no unhandled request.
- oxlint exits 0.
- TypeScript/Vite build exits 0.
- `git diff --check` prints nothing.
- `git status --short` shows only intentional task changes plus the pre-existing untracked `backend/database/on` and `frontend/test-results/` if they still exist.

- [ ] **Step 2: Verify the permission-aware dialog inventory**

Use the seeded local accounts and do not claim a dialog is tested under a role that cannot open it:

| Role | Dialogs |
| --- | --- |
| School Admin | Create Student, Create/Supersede Fee Agreement, One-time Charge, Record Payment, Calendar Add/Edit/View/Delete |
| Finance | Verify Payment, Void Payment, Void Receipt |

For each dialog, confirm title, target context, first focus, size class, footer order, Cancel/Close, and submission loading label.

- [ ] **Step 3: Capture all target viewport states**

At `1440×900`, `1180×820`, `820×1180`, and `390×844`, capture:

1. Create Student Profile initial state.
2. Create and Supersede Fee Agreement initial state plus scrolled details.
3. One-time Charge initial state.
4. Record Payment with empty fees, loaded fees, allocation mismatch, balanced allocation, Additional details open, and inline One-time Charge open.
5. Verify Payment.
6. Void Payment eligible and issued-receipt-blocked.
7. Void Receipt.
8. Calendar Add, Edit, View-only, and Delete.

Expected at every viewport:

- No clipped Close control, focus ring, input, scrollbar, footer action, or context value.
- Workflow dialogs stay inside backdrop safe margins.
- iPad footer buttons remain grouped; phone stacks both buttons full width in secondary-then-primary order.
- Record Payment shows fee selection and balance status before supporting metadata.
- Fee Agreement shows total/review access before detailed fees on iPad.

- [ ] **Step 4: Run keyboard and accessibility interaction checks**

For one standard, one workflow, and one danger dialog:

1. Open from a focused trigger.
2. Confirm the approved initial focus.
3. Tab through every control.
4. Confirm the last Tab returns to Close and Shift+Tab from Close returns to the last control.
5. Confirm page controls behind the dialog cannot receive focus.
6. Trigger a validation error and confirm focus/scroll recovery.
7. Press Escape and confirm focus returns to the trigger.
8. Reopen and close with Cancel/Close; confirm page position does not change.

Inspect the accessibility tree or DOM:

- Dialog has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and optional `aria-describedby`.
- `#root` is inert and `aria-hidden="true"` only while the portal is mounted.
- Invalid fields reference visible error IDs.
- Danger consequences are written text, not color-only.

- [ ] **Step 5: Run 200% zoom and long-content checks**

Use:

- Student name: `Alyssa Nur Aisyah Tan Wei Ling Binti Abdullah`.
- Event title: `Primary Parent Consultation and Academic Progress Follow-up`.
- Receipt number: `MIS.A012345 (07/2026)`.
- A two-sentence server error.

At 200% zoom, confirm values wrap inside their own region, Close remains visible, body scroll stays internal, and there is no page-level horizontal scrollbar.

- [ ] **Step 6: Document real iPad limitations honestly**

Record whether a physical iPad Safari check was performed. If unavailable, write exactly:

```text
Physical iPad Safari was not available in this run. Browser viewport checks passed, but virtual-keyboard resizing, safe-area behavior, momentum scrolling, and VoiceOver remain device-verification items.
```

Do not label those items as passed based on desktop emulation.

- [ ] **Step 7: Fix only failures revealed by the matrix and rerun their gates**

For any failure:

1. Add or tighten an automated regression test when the behavior is testable.
2. Run the focused test and confirm it fails.
3. Apply the smallest scoped fix.
4. Run the focused test, full test suite, lint, build, and `git diff --check`.
5. Replace the rejected screenshot with a fresh capture at the same viewport and state.

Expected: no acceptance failure remains open.

- [ ] **Step 8: Commit verification fixes and evidence references**

If code changed during Task 9:

```powershell
git add frontend/src/App.tsx frontend/src/App.css frontend/src/App.test.tsx frontend/src/components/AdminUi.tsx frontend/src/components/AdminUi.css frontend/src/components/AdminUi.test.tsx frontend/src/components/CalendarPage.tsx frontend/src/components/CalendarPage.css frontend/src/components/CalendarPage.test.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.tsx frontend/src/features/fee-agreements/FeeAgreementEditor.css frontend/src/features/fee-agreements/FeeAgreementEditor.test.tsx frontend/src/features/fee-agreements/AgreementReviewPanel.tsx frontend/src/features/fee-agreements/FeeItemRow.tsx frontend/src/features/payments/PaymentAllocationEditor.tsx frontend/src/features/payments/PaymentAllocationEditor.test.tsx
git commit -m "fix: complete responsive modal acceptance"
```

If no code changed, do not create an empty commit. Keep screenshots outside the production source tree and reference their absolute evidence directory in the task handoff.

## Specification Coverage Matrix

| Approved requirement | Implementation task | Verification |
| --- | --- | --- |
| One portal-based dialog primitive, inert background, scroll lock, focus loop, cleanup | Task 1 | `AdminUi.test.tsx`, keyboard QA |
| Compact/standard/workflow sizes, default/danger tones, safe PC/iPad/phone sizing | Task 1 | CSS gates and four viewport captures |
| Semantic target context and associated field errors | Tasks 2 and 8 | helper unit tests plus family-level error tests |
| Create Student and One-time Charge language/layout/focus | Task 3 | school-admin role tests and responsive captures |
| Stable Calendar Add/Edit/View/Delete titles, context, safe focus, paired dates | Task 4 | Calendar regression suite and viewport matrix |
| Fee Agreement early iPad review without changing calculations | Task 5 | create/supersede component/App tests and scrolled captures |
| Record Payment fees/allocation/balance before metadata | Task 6 | order, state, payload, hidden-error and permission tests |
| Verify/Void target context, consequences, safe danger actions, issued-receipt guard | Task 7 | finance-role pending/verified/blocked/submission tests |
| Recoverable errors preserve values, open disclosures, focus and scroll | Task 8 | App/Calendar/Fee/Payment focused tests |
| PC, iPad landscape/portrait, phone, keyboard, 200% zoom, long text, device honesty | Task 9 | acceptance evidence and limitation statement |

## Final Plan Verification

Before declaring implementation complete:

- Every dialog in the approved inventory has an explicit `size`.
- Every danger dialog has `tone="danger"`, target context, written consequence, safe initial focus, and a distinct destructive action.
- `Manual Charge` is absent from user-facing dialog/action copy.
- `.financial-modal` no longer owns dialog width.
- PC and iPad media ranges do not overlap.
- The issued-receipt payment-void state has no enabled submit path.
- Record Payment Additional details opens for values and errors.
- Record Payment cannot submit until amount, allocation count, allocation completeness, and balance are valid.
- Calendar view-only uses Close and no save affordance.
- Portal cleanup restores prior `#root` attributes, body styles, page scroll, and trigger focus.
- School-admin and finance dialog inventories are exercised with role-specific permission fixtures.
- Full automated and visual matrices pass, with physical-iPad limitations stated accurately.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | ---: | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | — | Not required; approved Scheme B keeps the existing product direction |
| Codex Review | `/codex review` | Independent second opinion | 0 | — | Not run |
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 1 | CLEAR | 8 issues found and folded into the plan; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | Approved design tightened from 7/10 to 9/10 with no unresolved modal decision |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | Not needed for this user-facing layout pass |

**VERDICT:** DESIGN + ENG CLEARED — the plan is ready to implement.

NO UNRESOLVED DECISIONS
