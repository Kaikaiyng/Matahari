import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, apiRequest } from './api'
import type { CurrentUser } from './App'
import './PortalLogin.css'
import { useTenantConfiguration } from './tenant'

export function PortalLogin({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const tenant = useTenantConfiguration()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectDemo = (value: string) => {
    setUsername(value)
    setPassword('')
    setError('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await apiRequest<{ user: CurrentUser }>('/login', {
        method: 'POST',
        body: { username, password },
      })
      onLogin(response.user)
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="portal-login-page">
      <section className="portal-login-card" aria-labelledby="portal-login-title">
        <img src={tenant.branding.logo_url ?? '/logo.jpeg'} alt={tenant.branding.organization_name} className="portal-login-logo" />
        <p className="portal-login-eyebrow">{tenant.branding.app_title}</p>
        <h1 id="portal-login-title">Welcome to {tenant.branding.organization_short_name}</h1>
        <p className="portal-login-copy">School life, learning, and family records in one private App.</p>

        <div className="portal-demo-accounts" aria-label="Demo accounts">
          <button type="button" onClick={() => selectDemo('rachel.wong')}>
            <strong>Parent demo</strong><span>Rachel Wong</span>
          </button>
          <button type="button" onClick={() => selectDemo('alyssa.tan')}>
            <strong>Student demo</strong><span>Alyssa Tan</span>
          </button>
          <button type="button" onClick={() => selectDemo('teacher.lim')}>
            <strong>Teacher demo</strong><span>Ms Lim</span>
          </button>
        </div>

        {error && <p className="portal-login-error" role="alert">{error}</p>}

        <form onSubmit={submit}>
          <label htmlFor="portal-username">Username</label>
          <input id="portal-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          <label htmlFor="portal-password">Password</label>
          <input id="portal-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  )
}
