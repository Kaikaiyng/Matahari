import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bell,
  Building2,
  Check,
  Clock3,
  ExternalLink,
  Palette,
  Save,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { ApiError, apiRequest } from '../../api'
import { PageHeader, TimePicker } from '../../components/AdminUi'
import { useTenantConfiguration, type TenantConfiguration } from '../../tenant'
import './SettingsPage.css'

type SettingsSection = 'school' | 'branding' | 'attendance' | 'notifications' | 'users' | 'account'

type SettingsUser = {
  id: number
  name: string
  username: string
  school_id: number | null
  roles: string[]
  permissions: string[]
}

type SettingsDashboard = {
  school: { id: number; code: string; name: string }
}

type AttendanceSettings = {
  arrival_time: string
  dismissal_time: string
  notify_guardians_on_entry: boolean
  notify_guardians_on_exit: boolean
}

type SettingsPageProps = {
  user: SettingsUser
  dashboard: SettingsDashboard | null
  onNavigate: (page: 'employees' | 'attendance') => void
}

const sections: Array<{
  id: SettingsSection
  label: string
  description: string
  icon: typeof Building2
}> = [
  { id: 'school', label: 'School Profile', description: 'Resolved school and tenant context', icon: Building2 },
  { id: 'branding', label: 'Branding', description: 'Names, titles, logo and colours', icon: Palette },
  { id: 'attendance', label: 'Attendance', description: 'Campus time and device defaults', icon: Clock3 },
  { id: 'notifications', label: 'Notifications', description: 'In-app and guardian alerts', icon: Bell },
  { id: 'users', label: 'Users & Access', description: 'Positions and User Abilities', icon: Users },
  { id: 'account', label: 'My Account', description: 'Signed-in account information', icon: UserRound },
]

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) return error.message
  return fallback
}

function normalizeAttendance(value: AttendanceSettings): AttendanceSettings {
  return {
    ...value,
    arrival_time: value.arrival_time.slice(0, 5),
    dismissal_time: value.dismissal_time.slice(0, 5),
  }
}

export function SettingsPage({ user, dashboard, onNavigate }: SettingsPageProps) {
  const tenant = useTenantConfiguration()
  const [activeSection, setActiveSection] = useState<SettingsSection>('school')
  const [branding, setBranding] = useState(tenant.branding)
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [brandingError, setBrandingError] = useState('')
  const [brandingSuccess, setBrandingSuccess] = useState('')
  const [attendance, setAttendance] = useState<AttendanceSettings | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [attendanceSuccess, setAttendanceSuccess] = useState('')

  const canManageBranding = user.permissions.includes('tenant.settings.manage')
  const canManageAttendance = user.permissions.includes('attendance.devices.manage')
  const canManageEmployees = user.permissions.includes('foundation_accounts.manage')

  useEffect(() => setBranding(tenant.branding), [tenant.branding])

  useEffect(() => {
    if (!canManageAttendance || attendance || !['attendance', 'notifications'].includes(activeSection)) return
    let current = true
    setAttendanceLoading(true)
    setAttendanceError('')
    apiRequest<{ data: AttendanceSettings }>('/v1/admin/attendance/settings')
      .then(({ data }) => { if (current) setAttendance(normalizeAttendance(data)) })
      .catch((error) => { if (current) setAttendanceError(messageFrom(error, 'Unable to load Attendance settings.')) })
      .finally(() => { if (current) setAttendanceLoading(false) })
    return () => { current = false }
  }, [activeSection, attendance, canManageAttendance])

  const currentSection = useMemo(
    () => sections.find((section) => section.id === activeSection) ?? sections[0],
    [activeSection],
  )

  const selectSection = (section: SettingsSection) => {
    setActiveSection(section)
    setBrandingError('')
    setBrandingSuccess('')
    setAttendanceError('')
    setAttendanceSuccess('')
  }

  const saveBranding = async () => {
    setBrandingError('')
    setBrandingSuccess('')
    const required = [branding.organization_name, branding.organization_short_name, branding.admin_title, branding.app_title]
    if (required.some((value) => !value.trim())) {
      setBrandingError('Organization names and application titles are required.')
      return
    }
    if (branding.logo_url && !branding.logo_url.startsWith('https://')) {
      setBrandingError('Logo URL must use HTTPS.')
      return
    }
    if (![branding.primary_color, branding.accent_color].every((value) => /^#[0-9a-f]{6}$/i.test(value))) {
      setBrandingError('Brand colours must use six-digit hex values such as #c9254a.')
      return
    }

    setBrandingSaving(true)
    try {
      const { data } = await apiRequest<{ data: TenantConfiguration['branding'] }>('/v1/tenant/branding', {
        method: 'PATCH',
        body: { ...branding, logo_url: branding.logo_url || null },
      })
      setBranding(data)
      tenant.updateBranding(data)
      setBrandingSuccess('Branding saved across the Admin workspace.')
    } catch (error) {
      setBrandingError(messageFrom(error, 'Unable to save Branding.'))
    } finally {
      setBrandingSaving(false)
    }
  }

  const saveAttendance = async (successMessage: string) => {
    if (!attendance) return
    setAttendanceError('')
    setAttendanceSuccess('')
    setAttendanceSaving(true)
    try {
      const payload = normalizeAttendance(attendance)
      const { data } = await apiRequest<{ data: AttendanceSettings }>('/v1/admin/attendance/settings', {
        method: 'PUT',
        body: payload,
      })
      setAttendance(normalizeAttendance(data))
      setAttendanceSuccess(successMessage)
    } catch (error) {
      setAttendanceError(messageFrom(error, 'Unable to save Attendance settings.'))
    } finally {
      setAttendanceSaving(false)
    }
  }

  return (
    <section className="page-stack settings-page">
      <PageHeader
        eyebrow="Administration"
        title="System Settings"
        description="Manage the school configuration already supported by RYLAY."
      />

      <div className="settings-workspace">
        <aside className="settings-rail" aria-label="System settings sections">
          {sections.map((section) => {
            const Icon = section.icon
            const selected = section.id === activeSection
            return (
              <button
                key={section.id}
                type="button"
                className={`settings-rail-item${selected ? ' active' : ''}`}
                aria-current={selected ? 'page' : undefined}
                onClick={() => selectSection(section.id)}
              >
                <Icon size={20} aria-hidden="true" />
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </span>
              </button>
            )
          })}
        </aside>

        <main className="settings-content" aria-label={currentSection.label} key={activeSection}>
          {activeSection === 'school' && (
            <SettingsSectionHeader title="School Profile" description="The active context is resolved from this Admin domain and your membership." />
          )}
          {activeSection === 'school' && (
            <div className="settings-detail-grid">
              <ReadOnlyField label="Current school" value={dashboard?.school.name ?? tenant.branding.organization_name} />
              <ReadOnlyField label="School code" value={dashboard?.school.code ?? 'Not available'} />
              <ReadOnlyField label="School ID" value={String(dashboard?.school.id ?? user.school_id ?? 'Not selected')} />
              <ReadOnlyField label="Tenant" value={`${tenant.name} (${tenant.slug})`} />
              <ReadOnlyField label="Timezone" value={tenant.timezone} />
              <ReadOnlyField label="Admin domain surface" value="Admin" />
              <InfoNote>School identity is read-only here because RYLAY does not currently expose a school-profile update endpoint.</InfoNote>
            </div>
          )}

          {activeSection === 'branding' && (
            <BrandingSection
              value={branding}
              disabled={!canManageBranding || brandingSaving}
              canSave={canManageBranding}
              saving={brandingSaving}
              error={brandingError}
              success={brandingSuccess}
              onChange={setBranding}
              onSave={() => void saveBranding()}
            />
          )}

          {activeSection === 'attendance' && (
            <AttendanceSection
              value={attendance}
              loading={attendanceLoading}
              canManage={canManageAttendance}
              saving={attendanceSaving}
              error={attendanceError}
              success={attendanceSuccess}
              onChange={setAttendance}
              onSave={() => void saveAttendance('Attendance times saved.')}
              onOpenDevices={() => onNavigate('attendance')}
            />
          )}

          {activeSection === 'notifications' && (
            <NotificationSection
              enabled={Boolean(tenant.features.notifications)}
              value={attendance}
              loading={attendanceLoading}
              canManage={canManageAttendance}
              saving={attendanceSaving}
              error={attendanceError}
              success={attendanceSuccess}
              onChange={setAttendance}
              onSave={() => void saveAttendance('Notification preferences saved.')}
            />
          )}

          {activeSection === 'users' && (
            <UsersSection canManage={canManageEmployees} onManage={() => onNavigate('employees')} />
          )}

          {activeSection === 'account' && (
            <AccountSection user={user} />
          )}
        </main>
      </div>
    </section>
  )
}

function SettingsSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="settings-content-header">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="settings-readonly-field"><span>{label}</span><strong>{value}</strong></div>
}

function InfoNote({ children }: { children: ReactNode }) {
  return <p className="settings-info-note">{children}</p>
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (error) return <p className="settings-feedback error" role="alert">{error}</p>
  if (success) return <p className="settings-feedback success" role="status"><Check size={17} />{success}</p>
  return null
}

function BrandingSection({
  value,
  disabled,
  canSave,
  saving,
  error,
  success,
  onChange,
  onSave,
}: {
  value: TenantConfiguration['branding']
  disabled: boolean
  canSave: boolean
  saving: boolean
  error: string
  success: string
  onChange: (value: TenantConfiguration['branding']) => void
  onSave: () => void
}) {
  const field = (key: keyof TenantConfiguration['branding'], next: string) => onChange({ ...value, [key]: next })
  return (
    <>
      <SettingsSectionHeader title="Branding" description="Identity shared by this tenant's Admin and School App surfaces." />
      <div className="settings-form-grid">
        <label className="settings-field settings-span-2">Organization name<input disabled={disabled} value={value.organization_name} onChange={(event) => field('organization_name', event.target.value)} /></label>
        <label className="settings-field">Short name<input disabled={disabled} value={value.organization_short_name} onChange={(event) => field('organization_short_name', event.target.value)} /></label>
        <label className="settings-field">Admin title<input disabled={disabled} value={value.admin_title} onChange={(event) => field('admin_title', event.target.value)} /></label>
        <label className="settings-field">School App title<input disabled={disabled} value={value.app_title} onChange={(event) => field('app_title', event.target.value)} /></label>
        <label className="settings-field">HTTPS logo URL<input disabled={disabled} type="url" placeholder="https://…" value={value.logo_url ?? ''} onChange={(event) => field('logo_url', event.target.value)} /></label>
        <ColourField label="Primary colour" value={value.primary_color} disabled={disabled} onChange={(next) => field('primary_color', next)} />
        <ColourField label="Accent colour" value={value.accent_color} disabled={disabled} onChange={(next) => field('accent_color', next)} />
      </div>
      {!canSave && <InfoNote>You have read-only access. Tenant Settings permission is required to change Branding.</InfoNote>}
      <Feedback error={error} success={success} />
      {canSave && <ActionButton label="Save Branding" saving={saving} onClick={onSave} />}
    </>
  )
}

function ColourField({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="settings-field">
      {label}
      <span className="settings-colour-input">
        <span style={{ background: /^#[0-9a-f]{6}$/i.test(value) ? value : 'transparent' }} aria-hidden="true" />
        <input disabled={disabled} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  )
}

function AttendanceState({ loading, canManage, value, error }: { loading: boolean; canManage: boolean; value: AttendanceSettings | null; error: string }) {
  if (!canManage) return <InfoNote>Attendance Devices & Settings permission is required to view or change these school-wide defaults.</InfoNote>
  if (loading) return <div className="settings-panel-placeholder" aria-label="Loading Attendance settings"><span /><span /><span /></div>
  if (error && !value) return <p className="settings-feedback error" role="alert">{error}</p>
  return null
}

function AttendanceSection({ value, loading, canManage, saving, error, success, onChange, onSave, onOpenDevices }: {
  value: AttendanceSettings | null
  loading: boolean
  canManage: boolean
  saving: boolean
  error: string
  success: string
  onChange: (value: AttendanceSettings) => void
  onSave: () => void
  onOpenDevices: () => void
}) {
  return (
    <>
      <SettingsSectionHeader title="Attendance" description="School-wide campus arrival and dismissal defaults." />
      <AttendanceState loading={loading} canManage={canManage} value={value} error={error} />
      {canManage && value && (
        <div className="settings-form-grid">
          <label className="settings-field">Expected arrival time<TimePicker value={value.arrival_time} onChange={(time) => onChange({ ...value, arrival_time: time })} ariaLabel="Expected arrival time" disabled={saving} /></label>
          <label className="settings-field">Dismissal time<TimePicker value={value.dismissal_time} onChange={(time) => onChange({ ...value, dismissal_time: time })} ariaLabel="Dismissal time" disabled={saving} /></label>
        </div>
      )}
      <div className="settings-action-row">
        {canManage && value && <ActionButton label="Save Attendance" saving={saving} onClick={onSave} />}
        {canManage && <button type="button" className="settings-secondary-action" onClick={onOpenDevices}>Open Attendance Devices<ExternalLink size={16} /></button>}
      </div>
      <Feedback error={value ? error : ''} success={success} />
    </>
  )
}

function NotificationSection({ enabled, value, loading, canManage, saving, error, success, onChange, onSave }: {
  enabled: boolean
  value: AttendanceSettings | null
  loading: boolean
  canManage: boolean
  saving: boolean
  error: string
  success: string
  onChange: (value: AttendanceSettings) => void
  onSave: () => void
}) {
  return (
    <>
      <SettingsSectionHeader title="Notifications" description="Current in-app delivery and guardian campus alerts." />
      <div className="settings-channel-status">
        <span className={enabled ? 'enabled' : 'disabled'}><Bell size={19} /></span>
        <div><strong>In-app notification channel</strong><p>{enabled ? 'Enabled for this tenant' : 'Disabled for this tenant'}</p></div>
        <b className={enabled ? 'enabled' : 'disabled'}>{enabled ? 'Active' : 'Inactive'}</b>
      </div>
      <AttendanceState loading={loading} canManage={canManage} value={value} error={error} />
      {canManage && value && (
        <div className="settings-toggle-list">
          <ToggleRow label="Notify guardians when a student enters" description="Send an in-app alert after a recorded campus entry." checked={value.notify_guardians_on_entry} disabled={saving} onChange={(checked) => onChange({ ...value, notify_guardians_on_entry: checked })} />
          <ToggleRow label="Notify guardians when a student exits" description="Send an in-app alert after a recorded campus exit." checked={value.notify_guardians_on_exit} disabled={saving} onChange={(checked) => onChange({ ...value, notify_guardians_on_exit: checked })} />
        </div>
      )}
      {canManage && value && <ActionButton label="Save Notifications" saving={saving} onClick={onSave} />}
      <Feedback error={value ? error : ''} success={success} />
    </>
  )
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input aria-label={label} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}

function UsersSection({ canManage, onManage }: { canManage: boolean; onManage: () => void }) {
  const positions = [
    ['School Admin', 'School operations and administration defaults.'],
    ['Finance', 'School Admin capabilities plus supported finance operations.'],
    ['Teacher', 'Assigned teaching scope with optional individual User Abilities.'],
  ]
  return (
    <>
      <SettingsSectionHeader title="Users & Access" description="Positions provide defaults; User Abilities adjust an individual employee." />
      <div className="settings-position-list">
        {positions.map(([name, description]) => <article key={name}><ShieldCheck size={19} /><div><strong>{name}</strong><p>{description}</p></div></article>)}
      </div>
      {canManage ? <button type="button" className="settings-primary-action" onClick={onManage}>Manage Employees<ExternalLink size={16} /></button> : <InfoNote>You have read-only access to this summary.</InfoNote>}
    </>
  )
}

function AccountSection({ user }: { user: SettingsUser }) {
  return (
    <>
      <SettingsSectionHeader title="My Account" description="Your current signed-in identity and effective access." />
      <div className="settings-account-card">
        <span>{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
        <div><h3>{user.name}</h3><p>@{user.username}</p></div>
      </div>
      <div className="settings-detail-grid">
        <ReadOnlyField label="Roles" value={user.roles.join(', ') || 'No role assigned'} />
        <ReadOnlyField label="Effective permissions" value={`${user.permissions.length} granted`} />
        <ReadOnlyField label="School ID" value={String(user.school_id ?? 'Not selected')} />
        <ReadOnlyField label="Account ID" value={String(user.id)} />
      </div>
    </>
  )
}

function ActionButton({ label, saving, onClick }: { label: string; saving: boolean; onClick: () => void }) {
  return <button type="button" className="settings-primary-action" disabled={saving} onClick={onClick}><Save size={17} />{saving ? 'Saving…' : label}</button>
}
