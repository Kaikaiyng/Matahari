import { render, screen } from '@testing-library/react'
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

describe('AdminUi', () => {
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

  it('explains the session bootstrap state', () => {
    render(<SessionLoader logoSrc="/mis-logo.jpg" brand="Matahari School ERP" />)

    expect(screen.getByRole('heading', { name: 'Checking your session' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Verifying your secure admin access')
  })
})
