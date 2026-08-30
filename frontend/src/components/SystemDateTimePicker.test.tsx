import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimePicker } from './SystemDateTimePicker'

describe('TimePicker', () => {
  it('edits a time with compact hour, minute, and period controls', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimePicker value="08:00" onChange={onChange} ariaLabel="Start time" />)

    await user.click(screen.getByRole('button', { name: 'Start time' }))

    const dialog = screen.getByRole('dialog', { name: 'Select time' })
    expect(within(dialog).getByText('8:00 am')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: /o'clock$/ })).toHaveLength(12)

    await user.click(within(dialog).getByRole('button', { name: "9 o'clock" }))
    await user.click(within(dialog).getByRole('button', { name: '30 minutes' }))
    await user.click(within(dialog).getByRole('button', { name: 'PM' }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('21:30')
  })

  it('closes without changing the value when cancelled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimePicker value="08:00" onChange={onChange} ariaLabel="Start time" />)

    await user.click(screen.getByRole('button', { name: 'Start time' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Select time' })).not.toBeInTheDocument()
  })
})
