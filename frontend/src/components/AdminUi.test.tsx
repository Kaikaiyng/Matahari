import { createRef } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DataPanel,
  FilterToolbar,
  ModalFrame,
  PageHeader,
  SessionLoader,
  StatCard,
  StatusBadge,
} from './AdminUi'

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

describe('AdminUi', () => {
  it('exposes an interactive metric as an accessible button', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <StatCard
        label="Outstanding Fees"
        value="RM 800"
        tone="warning"
        onClick={onClick}
        actionLabel="Open Fee Record"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open Fee Record' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders page context, actions, metrics, filters, and data regions', () => {
    render(
      <>
        <PageHeader
          eyebrow="Student management"
          title="Students"
          description="Manage student profiles"
          action={<button>Add Student</button>}
        />
        <StatCard label="Visible Students" value="4" tone="positive" />
        <FilterToolbar ariaLabel="Student filters">
          <input aria-label="Search students" />
        </FilterToolbar>
        <DataPanel title="Student List">
          <table>
            <tbody>
              <tr>
                <td>Alyssa Tan</td>
              </tr>
            </tbody>
          </table>
        </DataPanel>
        <StatusBadge tone="positive">Active</StatusBadge>
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Students' })).toBeInTheDocument()
    expect(screen.getByText('Manage student profiles')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Student' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Student filters' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Student List' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toHaveClass('status-badge', 'positive')
  })

  it('exposes explicit close and cancel controls in a modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <ModalFrame
        title="Create Student"
        description="Add a profile"
        onClose={onClose}
        footer={<button onClick={onClose}>Cancel</button>}
      >
        <label>
          Student Name
          <input />
        </label>
      </ModalFrame>,
    )

    expect(screen.getByRole('dialog', { name: 'Create Student' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close Create Student' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes a modal with Escape and restores focus when removed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { rerender } = render(<button>Open editor</button>)

    const openButton = screen.getByRole('button', { name: 'Open editor' })
    openButton.focus()
    rerender(
      <>
        <button>Open editor</button>
        <ModalFrame title="Editor" onClose={onClose} footer={<button>Save</button>}>
          Form content
        </ModalFrame>
      </>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()

    rerender(<button>Open editor</button>)
    expect(screen.getByRole('button', { name: 'Open editor' })).toHaveFocus()
  })

  it('portals the dialog, associates its description, and isolates the app root', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)
    const view = render(<DialogHarness onClose={() => undefined} />, { container: root })

    const dialog = screen.getByRole('dialog', { name: 'Record Payment' })
    expect(dialog.parentElement).toBe(document.body.querySelector('.modal-backdrop'))
    expect(dialog).toHaveClass('modal-frame--workflow', 'modal-frame--danger')
    expect(dialog).toHaveAccessibleDescription('Allocate this payment.')
    expect(root).toHaveAttribute('inert')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(document.body.style.overflow).toBe('hidden')

    view.unmount()
    root.remove()
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

  it('restores previous root and body state when removed', () => {
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

    root.remove()
    trigger.remove()
    document.body.style.overflow = ''
  })

  it('preserves a pre-existing inert root attribute', () => {
    const root = document.createElement('div')
    root.id = 'root'
    root.setAttribute('inert', '')
    document.body.append(root)

    const view = render(<DialogHarness onClose={() => undefined} />, { container: root })
    view.unmount()

    expect(root).toHaveAttribute('inert')
    root.remove()
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

  it('explains the session bootstrap state', () => {
    render(<SessionLoader logoSrc="/mis-logo.jpg" brand="Matahari School ERP" />)

    expect(screen.getByRole('heading', { name: 'Checking your session' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Verifying your secure admin access')
  })
})
