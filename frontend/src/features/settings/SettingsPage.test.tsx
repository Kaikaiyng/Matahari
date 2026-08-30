import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../api'
import { useTenantConfiguration } from '../../tenant'
import { SettingsPage } from './SettingsPage'

vi.mock('../../api', () => ({ apiRequest: vi.fn() }))
vi.mock('../../tenant', () => ({ useTenantConfiguration: vi.fn() }))

const mockedApiRequest = vi.mocked(apiRequest)
const mockedTenant = vi.mocked(useTenantConfiguration)
const updateBranding = vi.fn()
const navigate = vi.fn()

const tenant = {
  id: 1,
  slug: 'mis',
  name: 'MIS Tenant',
  surface: 'admin' as const,
  timezone: 'Asia/Kuala_Lumpur',
  locale: 'en',
  branding: {
    organization_name: 'Matahari International School',
    organization_short_name: 'MIS',
    admin_title: 'Administration & Finance',
    app_title: 'MIS Community',
    logo_url: null,
    primary_color: '#c9254a',
    accent_color: '#1f2a44',
  },
  features: { notifications: true, attendance: true },
  updateBranding,
}

const dashboard = {
  school: { id: 1, code: 'MIS', name: 'Matahari International School' },
}

const admin = {
  id: 1,
  name: 'School Admin',
  username: 'admin',
  school_id: 1,
  roles: ['school-admin'],
  permissions: ['tenant.settings.manage', 'school.settings.manage', 'attendance.devices.manage', 'foundation_accounts.manage'],
}

const schoolInformation = {
  name: 'Matahari International School',
  registration_number: 'MIS-2026-01',
  group_member_line: 'A member of Matahari Education Group',
  address: 'Johor Bahru, Johor',
  phone: '+60 7-123 4567',
  email: 'office@matahari.test',
  operating_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
}

const appSupport = {
  call_phone: '+60 12-345 6789',
  whatsapp_phone: '+60 12-345 6789',
  support_email: 'support@matahari.test',
  operating_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
}

const attendance = {
  arrival_time: '08:00',
  dismissal_time: '15:00',
  notify_guardians_on_entry: true,
  notify_guardians_on_exit: false,
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
    mockedApiRequest.mockImplementation(async (path, options) => {
      if (path === '/v1/admin/settings/school-information') return { data: options?.method === 'PUT' ? schoolInformation : schoolInformation } as never
      if (path === '/v1/admin/settings/app-support') return { data: appSupport } as never
      if (path === '/v1/admin/attendance/settings') return { data: attendance } as never
      if (path === '/v1/tenant/branding') return { data: tenant.branding } as never
      throw new Error(`Unexpected API request: ${path}`)
    })
    mockedTenant.mockReturnValue(tenant)
    updateBranding.mockReset()
    navigate.mockReset()
  })

  it('uses real settings sections and routes users to existing workspaces', async () => {
    const user = userEvent.setup()
    render(<SettingsPage user={admin} dashboard={dashboard} onNavigate={navigate} />)

    expect(screen.getByRole('heading', { name: 'System Settings' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Matahari International School')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Users & Access/i }))
    await user.click(screen.getByRole('button', { name: 'Manage Employees' }))
    expect(navigate).toHaveBeenCalledWith('employees')
  })

  it('saves branding and refreshes tenant consumers immediately', async () => {
    const user = userEvent.setup()
    mockedApiRequest.mockImplementation(async (path) => {
      if (path === '/v1/admin/settings/school-information') return { data: schoolInformation } as never
      if (path === '/v1/tenant/branding') return { data: { ...tenant.branding, organization_name: 'MIS Academy' } } as never
      throw new Error(`Unexpected API request: ${path}`)
    })
    render(<SettingsPage user={admin} dashboard={dashboard} onNavigate={navigate} />)

    await user.click(screen.getByRole('button', { name: /Branding/i }))
    const name = screen.getByLabelText('Organization name')
    await user.clear(name)
    await user.type(name, 'MIS Academy')
    await user.click(screen.getByRole('button', { name: 'Save Branding' }))

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledWith('/v1/tenant/branding', expect.objectContaining({ method: 'PATCH' })))
    expect(updateBranding).toHaveBeenCalledWith(expect.objectContaining({ organization_name: 'MIS Academy' }))
  })

  it('shares one Attendance settings payload between time and notification controls', async () => {
    const user = userEvent.setup()
    render(<SettingsPage user={admin} dashboard={dashboard} onNavigate={navigate} />)

    await user.click(screen.getByRole('button', { name: /Notifications/i }))
    await screen.findByLabelText('Notify guardians when a student exits')
    await user.click(screen.getByText('Notify guardians when a student exits'))
    await user.click(screen.getByRole('button', { name: 'Save Notifications' }))

    await waitFor(() => expect(mockedApiRequest).toHaveBeenLastCalledWith('/v1/admin/attendance/settings', {
      method: 'PUT',
      body: { ...attendance, notify_guardians_on_exit: true },
    }))
  })

  it('saves school information and previews App Support contacts', async () => {
    const user = userEvent.setup()
    render(<SettingsPage user={admin} dashboard={dashboard} onNavigate={navigate} />)

    const registration = await screen.findByLabelText('Registration number')
    await user.clear(registration)
    await user.type(registration, 'MIS-NEW-01')
    await user.click(screen.getByRole('button', { name: 'Save School Information' }))
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledWith('/v1/admin/settings/school-information', expect.objectContaining({ method: 'PUT' })))

    await user.click(screen.getByRole('button', { name: /App Support/i }))
    expect(await screen.findByText('Contact Support')).toBeInTheDocument()
    expect(screen.getByText('+60 12-345 6789')).toBeInTheDocument()
    expect(screen.getByText('support@matahari.test')).toBeInTheDocument()
  })

  it('does not expose save actions without their backend abilities', async () => {
    const user = userEvent.setup()
    render(<SettingsPage user={{ ...admin, permissions: [] }} dashboard={dashboard} onNavigate={navigate} />)

    expect(await screen.findByLabelText('School name')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save School Information' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Branding/i }))
    expect(screen.queryByRole('button', { name: 'Save Branding' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Organization name')).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Notifications/i }))
    expect(screen.queryByRole('button', { name: 'Save Notifications' })).not.toBeInTheDocument()
    expect(mockedApiRequest).not.toHaveBeenCalledWith('/v1/admin/attendance/settings')
  })

  it('keeps platform owner settings editable when a cached permission list is stale', async () => {
    render(<SettingsPage user={{ ...admin, is_platform_owner: true, permissions: [] }} dashboard={dashboard} onNavigate={navigate} />)

    expect(await screen.findByLabelText('School name')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save School Information' })).toBeInTheDocument()
  })
})
