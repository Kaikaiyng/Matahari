/* oxlint-disable react/only-export-components -- colocated context hook is the public tenant API */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiRequest } from './api'

export type TenantConfiguration = {
  id: number
  slug: string
  name: string
  surface: 'admin' | 'app' | null
  timezone: string
  locale: string
  branding: {
    organization_name: string
    organization_short_name: string
    admin_title: string
    app_title: string
    logo_url: string | null
    primary_color: string
    accent_color: string
  }
  features: Record<string, boolean>
}

export const fallbackTenant: TenantConfiguration = {
  id: 0, slug: 'mis', name: 'Matahari International School', surface: null, timezone: 'Asia/Kuala_Lumpur', locale: 'en',
  branding: { organization_name: 'Matahari International School', organization_short_name: 'MIS', admin_title: 'Administration & Finance', app_title: 'MIS Community', logo_url: null, primary_color: '#c9254a', accent_color: '#1f2a44' },
  features: {},
}

export type TenantConfigurationContextValue = TenantConfiguration & {
  updateBranding: (branding: TenantConfiguration['branding']) => void
}

const TenantConfigurationContext = createContext<TenantConfigurationContextValue>({
  ...fallbackTenant,
  updateBranding: () => undefined,
})

export function useTenantConfiguration() { return useContext(TenantConfigurationContext) }

export function TenantConfigurationProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfiguration | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiRequest<{ data: TenantConfiguration }>('/tenant-context').then(({ data }) => {
      if (data.surface && data.surface !== 'admin') throw new Error('This domain is not configured for the Admin Panel.')
      setTenant(data)
      document.documentElement.style.setProperty('--brand-primary', data.branding.primary_color)
      document.documentElement.style.setProperty('--tenant-accent', data.branding.accent_color)
      document.title = `${data.branding.organization_name} · ${data.branding.admin_title}`
    }).catch(() => setError(true))
  }, [])

  const updateBranding = useCallback((branding: TenantConfiguration['branding']) => {
    setTenant((current) => current ? { ...current, branding } : current)
    document.documentElement.style.setProperty('--brand-primary', branding.primary_color)
    document.documentElement.style.setProperty('--tenant-accent', branding.accent_color)
    document.title = `${branding.organization_name} · ${branding.admin_title}`
  }, [])

  const value = useMemo<TenantConfigurationContextValue | null>(
    () => tenant ? { ...tenant, updateBranding } : null,
    [tenant, updateBranding],
  )

  if (error) return <main className="session-loader"><h1>Workspace unavailable</h1><p>This domain is not assigned to an active Admin tenant.</p></main>
  if (!tenant) return <main className="session-loader"><p>Loading workspace…</p></main>
  return <TenantConfigurationContext.Provider value={value!}>{children}</TenantConfigurationContext.Provider>
}
