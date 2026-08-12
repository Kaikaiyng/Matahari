import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiRequest } from './api'
import { MobileShell } from './components/MobileShell'
import { ParentPortalView } from './components/ParentPortalView'
import { StudentPortalView } from './components/StudentPortalView'
import { PortalLogin } from './PortalLogin'

export type CurrentUser = {
  id: number
  name: string
  username: string
  school_id: number | null
  roles: string[]
  permissions: string[]
}

type PortalRole = 'parent' | 'student'

function App() {
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'authenticated'>('checking')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [selectedRole, setSelectedRole] = useState<PortalRole | null>(null)

  useEffect(() => {
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
  }, [])

  const allowedRoles = useMemo<PortalRole[]>(() => {
    if (!user) return []
    return [
      ...(user.roles.includes('parent') ? ['parent' as const] : []),
      ...(user.roles.includes('student') ? ['student' as const] : []),
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

  if (authState === 'checking') {
    return <main className="portal-state-screen"><img src="/logo.jpeg" alt="" /><h1>Loading MIS App</h1><p>Checking your secure session…</p></main>
  }

  if (!user) return <PortalLogin onLogin={(loggedInUser) => { setUser(loggedInUser); setAuthState('authenticated') }} />

  if (!activeRole) {
    return <main className="portal-state-screen"><img src="/logo.jpeg" alt="" /><h1>App access unavailable</h1><p>This account does not have a Parent or Student role.</p><button type="button" onClick={() => void logout()}>Sign out</button></main>
  }

  const environment = import.meta.env.VITE_APP_ENVIRONMENT === 'production' ? 'production' : 'staging'

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userRole={activeRole}
      allowedRoles={allowedRoles}
      onRoleChange={(role) => { setSelectedRole(role); setActiveTab('home') }}
      onLogout={() => void logout()}
      userName={user.name}
      environment={environment}
    >
      {activeRole === 'student'
        ? <StudentPortalView studentName={user.name} activeTab={activeTab} />
        : <ParentPortalView parentName={user.name} activeTab={activeTab} />}
    </MobileShell>
  )
}

export default App
