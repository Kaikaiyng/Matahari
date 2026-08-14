import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'
import { TenantConfigurationProvider, useTenantConfiguration } from './tenant'

vi.mock('./api', () => ({ apiRequest: vi.fn() }))
const mockedApiRequest = vi.mocked(apiRequest)

function Probe() { const tenant = useTenantConfiguration(); return <p>{tenant.branding.organization_name} · {tenant.surface}</p> }

describe('App tenant bootstrap', () => {
  beforeEach(() => mockedApiRequest.mockReset())

  it('loads branding from the host-resolved App tenant', async () => {
    mockedApiRequest.mockResolvedValue({ data: { id: 3, slug: 'bravo', name: 'Bravo', surface: 'app', timezone: 'Asia/Kuala_Lumpur', locale: 'en', branding: { organization_name: 'Bravo School', organization_short_name: 'BRV', admin_title: 'Admin', app_title: 'Bravo Community', logo_url: null, primary_color: '#112233', accent_color: '#445566' }, features: { community: true } } })
    render(<TenantConfigurationProvider><Probe /></TenantConfigurationProvider>)
    expect(await screen.findByText('Bravo School · app')).toBeInTheDocument()
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#112233')
  })

  it('fails closed when an Admin domain serves the App build', async () => {
    mockedApiRequest.mockResolvedValue({ data: { id: 3, slug: 'bravo', name: 'Bravo', surface: 'admin', timezone: 'Asia/Kuala_Lumpur', locale: 'en', branding: { organization_name: 'Bravo School', organization_short_name: 'BRV', admin_title: 'Admin', app_title: 'Bravo Community', logo_url: null, primary_color: '#112233', accent_color: '#445566' }, features: {} } })
    render(<TenantConfigurationProvider><Probe /></TenantConfigurationProvider>)
    expect(await screen.findByRole('heading', { name: 'Workspace unavailable' })).toBeInTheDocument()
  })
})
