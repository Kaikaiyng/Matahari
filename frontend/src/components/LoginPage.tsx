import React, { useState } from 'react'
import type { FormEvent } from 'react'
import './LoginPage.css'
import { ApiError, apiRequest } from '../api'
import { productBrand } from '../branding'
import { BrandMark } from './BrandMark'
import {
  IconlyStaff,
  IconlyUsers,
  IconlyGraduationCap,
  IconlyCheck,
  IconlyPhone,
} from './icons/IconlyIcons'

export interface CurrentUser {
  id: number
  name: string
  username: string
  roles: string[]
  permissions: string[]
  school_id: number | null
}

const REMEMBERED_USERNAME_KEY = 'matahari.rememberedUsername'

function getRememberedUsername(): string {
  try {
    return window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export interface LoginPageProps {
  onLogin: (user: CurrentUser) => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState(getRememberedUsername)
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => Boolean(getRememberedUsername()))
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePersonaSelect = (roleUsername: string) => {
    setUsername(roleUsername)
    setPassword('')
    setError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await apiRequest<{ user: CurrentUser }>('/login', {
        method: 'POST',
        body: { username, password },
      })

      try {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBERED_USERNAME_KEY, response.user.username)
        } else {
          window.localStorage.removeItem(REMEMBERED_USERNAME_KEY)
        }
      } catch {
        // Storage fallback
      }

      onLogin(response.user)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Invalid username or password. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page-container">
      {/* Left Pane — Brand & Demo Personas */}
      <div className="login-hero-pane">
        <div className="login-brand-header">
          <BrandMark className="login-brand-mark" />
          <div>
            <div className="login-brand-title">{productBrand.organizationName}</div>
            <div className="login-brand-sub">{productBrand.productDescriptor}</div>
          </div>
        </div>

        <div className="login-hero-content">
          <h1 className="login-hero-headline">
            School Administration & Finance Portal
          </h1>
          <p className="login-hero-desc">
            Integrated ERP platform for student enrollment, fee agreements, automated billing, payment verification, and mobile portal access.
          </p>

          <div className="login-feature-list">
            <div className="login-feature-item">
              <div className="login-feature-icon">
                <IconlyGraduationCap size={20} color="var(--brand-primary, #e11d48)" />
              </div>
              <div className="login-feature-text">
                <strong>Academic Roster & Class Management</strong>
                <span>Organized student records and class rosters with full lifecycle tracking.</span>
              </div>
            </div>

            <div className="login-feature-item">
              <div className="login-feature-icon">
                <IconlyCheck size={20} color="var(--brand-primary, #e11d48)" />
              </div>
              <div className="login-feature-text">
                <strong>Fee Ledger & Official Receipts</strong>
                <span>Versioned fee agreements, monthly charges, and verified receipt issuance.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Demo Persona Chips */}
        <div className="login-persona-section">
          <div className="login-persona-title">
            <IconlyUsers size={16} color="#cbd5e1" /> Quick Demo Persona Logins
          </div>
          <div className="login-persona-grid">
            <button
              type="button"
              className="login-persona-btn"
              onClick={() => handlePersonaSelect('admin')}
            >
              <IconlyStaff size={20} color="#e11d48" />
              <div>
                <strong>Admin / Finance</strong>
                <small>Full administrative access</small>
              </div>
            </button>

            <button
              type="button"
              className="login-persona-btn"
              onClick={() => handlePersonaSelect('teacher.lim')}
            >
              <IconlyUsers size={20} color="#38bdf8" />
              <div>
                <strong>Teacher</strong>
                <small>Class & Academic view</small>
              </div>
            </button>

            <button
              type="button"
              className="login-persona-btn"
              onClick={() => handlePersonaSelect('rachel.wong')}
            >
              <IconlyUsers size={20} color="#fbbf24" />
              <div>
                <strong>Parent Portal</strong>
                <small>Rachel Wong (Multi-Class)</small>
              </div>
            </button>

            <button
              type="button"
              className="login-persona-btn"
              onClick={() => handlePersonaSelect('alyssa.tan')}
            >
              <IconlyGraduationCap size={20} color="#4ade80" />
              <div>
                <strong>Student Portal</strong>
                <small>Alyssa Tan (MB1)</small>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Right Pane — Authentication Form */}
      <div className="login-form-pane">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <h2>Welcome Back</h2>
            <p>Please enter your credentials to sign in to your account.</p>
          </div>

          {error && (
            <div className="login-error-banner">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="login-field-group">
              <label htmlFor="username">Username</label>
              <div className="login-input-wrap">
                <IconlyStaff size={18} className="login-input-icon" />
                <input
                  id="username"
                  type="text"
                  className="login-input"
                  placeholder="Enter username (e.g. admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="login-field-group">
              <label htmlFor="password">Password</label>
              <div className="login-input-wrap">
                <IconlyPhone size={18} className="login-input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <label className="login-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="login-footer-text">
            Protected by Matahari School Security & Audit System.
          </div>
        </div>
      </div>
    </div>
  )
}
