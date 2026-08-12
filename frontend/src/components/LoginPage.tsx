import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, apiRequest } from '../api'
import { productBrand } from '../branding'
import { BrandMark } from './BrandMark'
import './LoginPage.css'

export interface CurrentUser {
  id: number
  name: string
  username: string
  roles: string[]
  permissions: string[]
  school_id: number | null
}

const REMEMBERED_USERNAME_KEY = 'matahari.rememberedUsername'

function rememberedUsername(): string {
  try {
    return window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function LoginPage({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [username, setUsername] = useState(rememberedUsername)
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => Boolean(rememberedUsername()))
  const [showPassword, setShowPassword] = useState(false)
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
      try {
        if (rememberMe) window.localStorage.setItem(REMEMBERED_USERNAME_KEY, response.user.username)
        else window.localStorage.removeItem(REMEMBERED_USERNAME_KEY)
      } catch {
        // Local storage is optional.
      }
      onLogin(response.user)
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : 'Invalid username or password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <header className="admin-login-brand">
          <BrandMark className="admin-login-logo" />
          <div>
            <strong>{productBrand.organizationName}</strong>
            <span>Administration & Finance</span>
          </div>
        </header>

        <div className="admin-login-heading">
          <p>Secure staff access</p>
          <h1 id="admin-login-title">Admin Panel</h1>
          <span>Sign in with an authorized staff account.</span>
        </div>

        <div className="admin-demo-users" aria-label="Admin demo accounts">
          <button type="button" onClick={() => selectDemo('admin')}><strong>School Admin</strong><span>admin</span></button>
          <button type="button" onClick={() => selectDemo('finance')}><strong>Finance</strong><span>finance</span></button>
        </div>

        {error && <p className="admin-login-error" role="alert">{error}</p>}

        <form onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required autoFocus />

          <label htmlFor="password">Password</label>
          <div className="admin-password-field">
            <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <label className="admin-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />Remember me</label>
          <button className="admin-login-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Login'}</button>
        </form>

        <footer>Protected by MIS role permissions and audit controls.</footer>
      </section>
    </main>
  )
}
