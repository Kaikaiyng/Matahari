import { createRef } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DataPanel,
  CustomSelect,
  FieldError,
  FilterToolbar,
  ModalFrame,
  ModalContextSummary,
  PageHeader,
  SessionLoader,
  StatCard,
  StatusBadge,
  fieldErrorProps,
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
  it('uses the MAW searchable menu treatment for longer select lists', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CustomSelect
        ariaLabel="Event type"
        value="school-event"
        onChange={onChange}
        options={[
          { value: 'appointment', label: 'Appointment' },
          { value: 'training', label: 'Training' },
          { value: 'meeting', label: 'Meeting' },
          { value: 'school-event', label: 'School event' },
          { value: 'holiday', label: 'Holiday' },
          { value: 'other', label: 'Other' },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'School event' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search Event type' }), 'train')

    const menu = screen.getByRole('listbox')
    expect(within(menu).getByRole('option', { name: 'Training' })).toBeInTheDocument()
    expect(within(menu).queryByRole('option', { name: 'Meeting' })).not.toBeInTheDocument()
    await user.click(within(menu).getByRole('option', { name: 'Training' }))
    expect(onChange).toHaveBeenCalledWith('training')
  })

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

  it('omits invalid attributes and error markup when a field has no error', () => {
    render(
      <label>
        Amount
        <input aria-label="Amount" {...fieldErrorProps('amount-error')} />
        <FieldError id="amount-error" />
      </label>,
    )

    expect(screen.getByLabelText('Amount')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('Amount')).not.toHaveAttribute('aria-describedby')
    expect(document.getElementById('amount-error')).toBeNull()
  })

  it('explains the session bootstrap state', () => {
    render(<SessionLoader />)

    expect(screen.getByRole('img', { name: 'Matahari International School logo' })).toBeInTheDocument()
    expect(screen.getByText('Matahari International School')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Checking your session' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Verifying your secure admin access')
  })
})
