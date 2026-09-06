import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../../api'
import { StudentProfileEditor } from './StudentProfileEditor'

vi.mock('../../api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api')>(),
  apiRequest: vi.fn(),
}))

const student = {
  id: 1, student_no: 'MIS-001', full_name: 'Sample Student', level_group: 'primary' as const,
  class: { id: 2, name: 'MA1' }, gender: null, dob: null,
  registration_date: '2026-01-08', notes: 'Original notes', status: 'active',
}
const classes = [
  { id: 2, name: 'MA1', level_group: 'primary' as const },
  { id: 8, name: 'MP1', level_group: 'secondary' as const },
]
const onSaved = vi.fn()
const onClose = vi.fn()
const onUnauthorized = vi.fn()
function openEditor() {
  render(<StudentProfileEditor student={student} schoolClasses={classes} onSaved={onSaved} onClose={onClose} onUnauthorized={onUnauthorized} />)
}

describe('student profile editor', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('loads existing values and patches only changed profile fields', async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockResolvedValue({ student: { ...student, full_name: 'Updated Student' } })
    openEditor()
    expect(screen.getByLabelText('Student ID')).toHaveValue('MIS-001')
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Student Name'))
    await user.type(screen.getByLabelText('Student Name'), 'Updated Student')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...student, full_name: 'Updated Student' }))
    expect(apiRequest).toHaveBeenCalledWith('/students/1', { method: 'PATCH', body: { full_name: 'Updated Student' } })
  })

  it('clears an incompatible class when level changes and sends null for cleared optional values', async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockResolvedValue({ student })
    openEditor()
    await user.selectOptions(screen.getByLabelText('Level Group'), 'secondary')
    expect(screen.getByLabelText('Class')).toHaveValue('')
    await user.clear(screen.getByLabelText('Remarks'))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(apiRequest).toHaveBeenCalledWith('/students/1', { method: 'PATCH', body: { level_group: 'secondary', class_id: null, notes: null } })
  })

  it('preserves the draft and focuses a server validation error', async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(422, 'Please check the profile.', { student_no: ['Student ID already exists.'] }))
    openEditor()
    await user.type(screen.getByLabelText('Student ID'), '-duplicate')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Student ID already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText('Student ID')).toHaveValue('MIS-001-duplicate')
    expect(screen.getByLabelText('Student ID')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByLabelText('Student ID')).toHaveFocus())
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('keeps unsaved changes when discard is declined', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    openEditor()
    await user.type(screen.getByLabelText('Remarks'), ' changed')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(apiRequest).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    confirm.mockRestore()
  })

  it('handles session expiry through the existing application login flow', async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(401, 'Unauthenticated.'))
    openEditor()
    await user.type(screen.getByLabelText('Remarks'), ' changed')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce())
    expect(onSaved).not.toHaveBeenCalled()
  })
})
