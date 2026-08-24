import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiRequest, AUTH_EXPIRED_EVENT } from './api'
import { MobileShell } from './components/MobileShell'
import { ParentPortalView } from './components/ParentPortalView'
import { StudentPortalView } from './components/StudentPortalView'
import { TeacherPortalView } from './components/TeacherPortalView'
import type { AppRole } from './components/MobileShell'
import { PortalLogin } from './PortalLogin'
import { useTenantConfiguration } from './tenant'
import { PublicPolicyPage } from './features/community-safety/PublicPolicyPage'
import { CommunityPolicyGate } from './features/community-safety/CommunityPolicyGate'

export type CurrentUser = {
  id: number
  name: string
  username: string
  school_id: number | null
  tenant_id?: number | null
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
  const [policiesAccepted, setPoliciesAccepted] = useState(false)

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

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null)
      setSelectedRole(null)
      setActiveTab('home')
      setPoliciesAccepted(false)
      setAuthState('guest')
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession)
  }, [])

  const allowedRoles = useMemo<AppRole[]>(() => {
    if (!user) return []
    return [
      ...(user.roles.includes('parent') ? ['parent' as const] : []),
      ...(user.roles.includes('student') ? ['student' as const] : []),
      ...(user.roles.includes('teacher') || user.permissions.includes('app.teacher_access') ? ['teacher' as const] : []),
    ]
  }, [user])
  const personaStorageKey = user ? `rylay.app.persona.${user.tenant_id ?? 'tenant'}.${user.id}` : null
  useEffect(() => {
    if (!personaStorageKey || allowedRoles.length === 0) return
    if (allowedRoles.length === 1) { setSelectedRole(allowedRoles[0]); return }
    const stored = window.localStorage.getItem(personaStorageKey) as AppRole | null
    setSelectedRole(stored && allowedRoles.includes(stored) ? stored : null)
  }, [personaStorageKey, allowedRoles])
  const activeRole = selectedRole && allowedRoles.includes(selectedRole) ? selectedRole : allowedRoles.length === 1 ? allowedRoles[0] : null
  const elevatedTeacher = Boolean(user && (user.permissions.includes('attendance.view_school') || user.permissions.includes('assessments.manage_school') || user.permissions.includes('community.moderate')))
  const canPublishUpdates = Boolean(user?.permissions.includes('community.publish'))
  const chooseRole = (role: AppRole) => {
    setSelectedRole(role)
    if (personaStorageKey) window.localStorage.setItem(personaStorageKey, role)
    setActiveTab('home')
  }

  const logout = async () => {
    try {
      await apiRequest('/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setSelectedRole(null)
      setPoliciesAccepted(false)
      setActiveTab('home')
      setAuthState('guest')
    }
  }

  if (publicPolicySlug) return <PublicPolicyPage slug={publicPolicySlug} />

  if (authState === 'checking') {
    return <main className="portal-state-screen"><img src={tenant.branding.logo_url ?? '/logo.jpeg'} alt="" /><h1>Loading {tenant.branding.organization_short_name} App</h1><p>Checking your secure session…</p></main>
  }

  if (!user) return <PortalLogin onLogin={(loggedInUser) => { setUser(loggedInUser); setAuthState('authenticated') }} />

  if (!activeRole && allowedRoles.length > 1) {
    return <main className="portal-state-screen persona-picker"><img src={tenant.branding.logo_url ?? '/logo.jpeg'} alt="" /><span className="persona-eyebrow">Choose how to continue</span><h1>Select your App view</h1><p>This account has more than one approved persona. Your choice will be remembered on this device.</p><div className="persona-options">{allowedRoles.map((role) => <button type="button" key={role} onClick={() => chooseRole(role)}><strong>{role[0].toUpperCase() + role.slice(1)}</strong><small>{role === 'teacher' ? 'Classes, attendance and teaching tools' : role === 'parent' ? 'Children, finance and school updates' : 'Timetable, learning and school updates'}</small></button>)}</div><button className="persona-signout" type="button" onClick={() => void logout()}>Sign out</button></main>
  }

  if (!activeRole) {
    return <main className="portal-state-screen"><img src="/logo.jpeg" alt="" /><h1>App access unavailable</h1><p>This account does not have an approved Parent, Student, or Teacher App persona.</p><button type="button" onClick={() => void logout()}>Sign out</button></main>
  }

  const environment = import.meta.env.VITE_APP_ENVIRONMENT === 'production' ? 'production' : 'staging'

  return (
    <>
      <div
        data-testid="authenticated-app-shell"
        inert={policiesAccepted ? undefined : true}
        aria-hidden={policiesAccepted ? undefined : true}
      >
        <MobileShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          userRole={activeRole}
          allowedRoles={allowedRoles}
          onRoleChange={chooseRole}
          userName={user.name}
          environment={environment}
          canPublishUpdates={canPublishUpdates}
        >
          {activeRole === 'student' && <StudentPortalView studentName={user.name} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} />}
          {activeRole === 'parent' && <ParentPortalView parentName={user.name} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} />}
          {activeRole === 'teacher' && <TeacherPortalView teacherName={user.name} activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => void logout()} staffMode={elevatedTeacher} canPublishUpdates={canPublishUpdates} />}
        </MobileShell>
      </div>
      {!policiesAccepted && <CommunityPolicyGate role={activeRole} onReadyChange={setPoliciesAccepted} />}
    </>
  )
}

export default App

function legalPolicySlug(pathname: string): string | null {
  const match = pathname.match(/^\/legal\/(terms|privacy|community-standards|child-safety|support|account-deletion)\/?$/)
  return match?.[1] ?? null
}
