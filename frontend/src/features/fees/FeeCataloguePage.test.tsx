import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeeCataloguePage } from './FeeCataloguePage'

const existingItem = {
  id: 1,
  code: 'TUITION',
  name: 'Tuition Fee',
  category: 'mandatory',
  fee_type: 'recurring',
  default_amount: 800,
  status: 'active',
}

describe('FeeCataloguePage', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=test'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads the real catalogue and creates a new fee item', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname.endsWith('/fee-items/catalogue')) {
        return new Response(JSON.stringify({ data: [existingItem] }), { status: 200 })
      }
      if (url.pathname.endsWith('/fee-items') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { ...existingItem, id: 2, code: 'UNIFORM', name: 'Uniform' } }), { status: 201 })
      }
      return new Response(JSON.stringify({ message: 'Unhandled' }), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<FeeCataloguePage canManage schoolId={1} onUnauthorized={() => undefined} />)
    expect(await screen.findByText('RM 800.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Fee Item' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Fee Item' })
    await user.type(within(dialog).getByLabelText('Item Name'), 'Uniform')
    await user.type(within(dialog).getByLabelText('Code'), 'uniform')
    await user.clear(within(dialog).getByLabelText('Default Amount (RM)'))
    await user.type(within(dialog).getByLabelText('Default Amount (RM)'), '125.50')
    await user.click(within(dialog).getByRole('button', { name: 'Add Fee Item' }))

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ name: 'Uniform', code: 'UNIFORM', school_id: 1 })
  })
})
