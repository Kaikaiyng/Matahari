import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, apiRequest } from '../api'
import { productBrand } from '../branding'
import { BrandMark } from './BrandMark'
import { IconlyCheck, IconlyGraduationCap, IconlyPhone, IconlyStaff, IconlyUsers } from './icons/IconlyIcons'
import './LoginPage.css'
import { useTenantConfiguration } from '../tenant'

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
  const tenant = useTenantConfiguration()
  const [username, setUsername] = useState(rememberedUsername)
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => Boolean(rememberedUsername()))
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectPersona = (value: string) => {
    setUsername(value)
    setPassword('')
    setError('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const response = await apiRequest<{ user: CurrentUser }>('/login', { method: 'POST', body: { username, password } })
      try {
        if (rememberMe) window.localStorage.setItem(REMEMBERED_USERNAME_KEY, response.user.username)
        else window.localStorage.removeItem(REMEMBERED_USERNAME_KEY)
      } catch {
        // Remembering the username is optional.
      }
      onLogin(response.user)
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : 'Invalid username or password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page-container">
      <section className="login-hero-pane" aria-label={`${tenant.branding.organization_short_name} Admin Panel`}>
        <header className="login-brand-header">
          <BrandMark className="login-brand-mark" />
          <div><div className="login-brand-title">{tenant.branding.organization_name || productBrand.organizationName}</div><div className="login-brand-sub">{tenant.branding.admin_title}</div></div>
        </header>

        <div className="login-hero-content">
          <p className="login-hero-kicker">{tenant.branding.organization_short_name} ADMIN PANEL</p>
          <h1 className="login-hero-headline">School administration,<br />kept in one place.</h1>
          <p className="login-hero-desc">Manage students, academic records, fee agreements, verified payments, and school operations through the staff workspace.</p>
          <div className="login-feature-list">
            <div className="login-feature-item"><span className="login-feature-icon"><IconlyGraduationCap size={20} /></span><div className="login-feature-text"><strong>Academic roster and classes</strong><span>School-scoped records with teaching-assignment controls.</span></div></div>
            <div className="login-feature-item"><span className="login-feature-icon"><IconlyCheck size={20} /></span><div className="login-feature-text"><strong>Finance and official receipts</strong><span>Versioned agreements, verified payments, and audit history.</span></div></div>
          </div>
        </div>

        <div className="login-persona-section">
          <div className="login-persona-title"><IconlyUsers size={16} /> Staff demo accounts</div>
          <div className="login-persona-grid">
            <button type="button" className="login-persona-btn" onClick={() => selectPersona('admin')}><IconlyStaff size={20} /><span><strong>School Admin</strong><small>admin</small></span></button>
            <button type="button" className="login-persona-btn" onClick={() => selectPersona('finance')}><IconlyCheck size={20} /><span><strong>Finance</strong><small>finance</small></span></button>
            <button type="button" className="login-persona-btn" onClick={() => selectPersona('teacher.lim')}><IconlyUsers size={20} /><span><strong>Teacher</strong><small>teacher.lim</small></span></button>
          </div>
          <p className="login-app-direction">Parents and students sign in through the separate {tenant.branding.organization_short_name} App.</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="login-form-wrapper">
          <div className="login-form-header"><p>Secure staff access</p><h2>Welcome back</h2><span>Enter your staff credentials to continue.</span></div>
          {error && <div className="login-error-banner" role="alert">{error}</div>}
          <form onSubmit={submit}>
            <div className="login-field-group"><label htmlFor="username">Username</label><div className="login-input-wrap"><IconlyStaff size={18} className="login-input-icon" /><input id="username" className="login-input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required autoFocus /></div></div>
            <div className="login-field-group"><label htmlFor="password">Password</label><div className="login-input-wrap"><IconlyPhone size={18} className="login-input-icon" /><input id="password" className="login-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" className="login-toggle-pw" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'Hide' : 'Show'}</button></div></div>
            <label className="login-checkbox-label"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>
            <button type="submit" className="login-submit-btn" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Login'}</button>
          </form>
          <div className="login-footer-text">Protected by tenant-scoped role permissions and audit controls.</div>
        </div>
      </section>
    </main>
  )
}
