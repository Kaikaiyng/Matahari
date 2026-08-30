import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'
import { TenantConfigurationProvider, useTenantConfiguration } from './tenant'

vi.mock('./api', () => ({ apiRequest: vi.fn() }))
const mockedApiRequest = vi.mocked(apiRequest)

function BrandingProbe() {
  const tenant = useTenantConfiguration()
  return (
    <button
      type="button"
      onClick={() => tenant.updateBranding({ ...tenant.branding, organization_name: 'Updated Academy', primary_color: '#abcdef' })}
    >
      {tenant.branding.organization_name}
    </button>
  )
}

function Probe() { const tenant = useTenantConfiguration(); return <p>{tenant.branding.organization_name} · {tenant.surface}</p> }

describe('Admin tenant bootstrap', () => {
  beforeEach(() => mockedApiRequest.mockReset())

  it('loads branding from the host-resolved Admin tenant', async () => {
    mockedApiRequest.mockResolvedValue({ data: { id: 2, slug: 'alpha', name: 'Alpha', surface: 'admin', timezone: 'Asia/Kuala_Lumpur', locale: 'en', branding: { organization_name: 'Alpha Academy', organization_short_name: 'AA', admin_title: 'Operations', app_title: 'Community', logo_url: null, primary_color: '#123456', accent_color: '#654321' }, features: { schedule: false } } })
    render(<TenantConfigurationProvider><Probe /></TenantConfigurationProvider>)
    expect(await screen.findByText('Alpha Academy · admin')).toBeInTheDocument()
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#123456')
  })

  it('fails closed when an App domain serves the Admin build', async () => {
    mockedApiRequest.mockResolvedValue({ data: { id: 2, slug: 'alpha', name: 'Alpha', surface: 'app', timezone: 'Asia/Kuala_Lumpur', locale: 'en', branding: { organization_name: 'Alpha Academy', organization_short_name: 'AA', admin_title: 'Operations', app_title: 'Community', logo_url: null, primary_color: '#123456', accent_color: '#654321' }, features: {} } })
    render(<TenantConfigurationProvider><Probe /></TenantConfigurationProvider>)
    expect(await screen.findByRole('heading', { name: 'Workspace unavailable' })).toBeInTheDocument()
  })

  it('updates branding consumers and document styling without reloading', async () => {
    mockedApiRequest.mockResolvedValue({ data: { id: 2, slug: 'alpha', name: 'Alpha', surface: 'admin', timezone: 'Asia/Kuala_Lumpur', locale: 'en', branding: { organization_name: 'Alpha Academy', organization_short_name: 'AA', admin_title: 'Operations', app_title: 'Community', logo_url: null, primary_color: '#123456', accent_color: '#654321' }, features: {} } })
    render(<TenantConfigurationProvider><BrandingProbe /></TenantConfigurationProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Alpha Academy' }))

    expect(screen.getByRole('button', { name: 'Updated Academy' })).toBeInTheDocument()
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#abcdef')
    expect(document.title).toContain('Updated Academy')
  })
})
