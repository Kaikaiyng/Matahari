import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeploymentBanner } from './DeploymentBanner'

describe('DeploymentBanner', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the runtime environment label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ environment_label: 'PRE-LAUNCH DEMO' }),
      }),
    )

    render(<DeploymentBanner />)

    expect(await screen.findByRole('status')).toHaveTextContent('PRE-LAUNCH DEMO')
  })

  it('fails closed to no banner when runtime information is unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<DeploymentBanner />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(container).toBeEmptyDOMElement()
  })
})
