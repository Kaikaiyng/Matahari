import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiRequest } from './api'
import { MobileShell } from './components/MobileShell'
import { ParentPortalView } from './components/ParentPortalView'
import { StudentPortalView } from './components/StudentPortalView'
import { TeacherPortalView } from './components/TeacherPortalView'
import type { AppRole } from './components/MobileShell'
import { PortalLogin } from './PortalLogin'
import { useTenantConfiguration } from './tenant'
import { PublicPolicyPage } from './features/community-safety/PublicPolicyPage'

export type CurrentUser = {
  id: number
  name: string
  username: string
  school_id: number | null
  roles: string[]
  permissions: string[]
}

function App() {
  const publicPolicySlug = legalPolicySlug(window.location.pathname)
  const tenant = useTenantConfiguration()
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'authenticated'>('checking')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null)

  useEffect(() => {
    if (publicPolicySlug) return
    apiRequest<{ user: CurrentUser }>('/me')
      .then(({ user: currentUser }) => {
        setUser(currentUser)
        setAuthState('authenticated')
      })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status === 401) {
          setUser(null)
        }
        setAuthState('guest')
      })
  }, [publicPolicySlug])

  const allowedRoles = useMemo<AppRole[]>(() => {
    if (!user) return []
    return [
      ...(user.roles.includes('parent') ? ['parent' as const] : []),
      ...(user.roles.includes('student') ? ['student' as const] : []),
      ...(user.roles.includes('teacher') ? ['teacher' as const] : []),
      ...(user.roles.some((role) => ['super-admin', 'tenant-owner', 'school-admin'].includes(role)) ? ['staff' as const] : []),
    ]
  }, [user])
  const activeRole = selectedRole && allowedRoles.includes(selectedRole) ? selectedRole : allowedRoles[0]

  const logout = async () => {
    try {
      await apiRequest('/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setSelectedRole(null)
      setActiveTab('home')
      setAuthState('guest')
    }
  }

  if (publicPolicySlug) return <PublicPolicyPage slug={publicPolicySlug} />

  if (authState === 'checking') {
    return <main className="portal-state-screen"><img src={tenant.branding.logo_url ?? '/logo.jpeg'} alt="" /><h1>Loading {tenant.branding.organization_short_name} App</h1><p>Checking your secure session…</p></main>
  }

  if (!user) return <PortalLogin onLogin={(loggedInUser) => { setUser(loggedInUser); setAuthState('authenticated') }} />

  if (!activeRole) {
    return <main className="portal-state-screen"><img src="/logo.jpeg" alt="" /><h1>App access unavailable</h1><p>This account does not have an approved Parent, Student, Teacher, or Staff App role.</p><button type="button" onClick={() => void logout()}>Sign out</button></main>
  }

  const environment = import.meta.env.VITE_APP_ENVIRONMENT === 'production' ? 'production' : 'staging'

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userRole={activeRole}
      allowedRoles={allowedRoles}
      onRoleChange={(role) => { setSelectedRole(role); setActiveTab('home') }}
      userName={user.name}
      environment={environment}
    >
      {activeRole === 'student' && <StudentPortalView studentName={user.name} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} />}
      {activeRole === 'parent' && <ParentPortalView parentName={user.name} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} />}
      {(activeRole === 'teacher' || activeRole === 'staff') && <TeacherPortalView teacherName={user.name} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} staffMode={activeRole === 'staff'} />}
    </MobileShell>
  )
}

export default App

function legalPolicySlug(pathname: string): string | null {
  const match = pathname.match(/^\/legal\/(terms|privacy|community-standards|child-safety|support)\/?$/)
  return match?.[1] ?? null
}
