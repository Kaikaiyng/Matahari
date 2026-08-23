import React, { useCallback, useEffect, useState } from 'react'
import { Edit3, ShieldCheck } from 'lucide-react'
import { IconlyUserPlus } from './icons/IconlyIcons'
import { apiRequest } from '../api'
import { CustomSelect, DataPanel, FilterToolbar, ModalFrame, PageHeader, StatCard, StatusBadge } from './AdminUi'

export interface StaffMember { id: number; staff_no: string; name: string; username: string; role: string; roles: string[]; status: string; assigned_classes: string[] }
interface AbilityItem { slug: string; label: string }
interface EmployeeAccess {
  position: 'school-admin' | 'finance' | 'teacher'
  positions: Array<{ value: string; label: string }>
  groups: Record<string, AbilityItem[]>
  dependencies: Record<string, string>
  position_defaults: Record<EmployeeAccess['position'], string[]>
  default_permissions: string[]
  permissions: string[]
  teacher_app_access: boolean
}

export const StaffPage: React.FC<{ permissions: string[]; currentUserId: number }> = ({ permissions, currentUserId }) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPosition, setFormPosition] = useState<EmployeeAccess['position']>('teacher')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [access, setAccess] = useState<EmployeeAccess | null>(null)
  const [positionDraft, setPositionDraft] = useState<EmployeeAccess['position']>('teacher')
  const [permissionDraft, setPermissionDraft] = useState<string[]>([])
  const [teacherAppAccess, setTeacherAppAccess] = useState(false)
  const [changeReason, setChangeReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const canManageAbilities = permissions.includes('employees.abilities.manage')

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const response = await apiRequest<{ data: StaffMember[] }>('/v1/admin/staff')
      setStaffList(response.data ?? [])
    } catch { setStaffList([]); setError('Unable to load employee records.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadStaff() }, [loadStaff])

  const addEmployee = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formName.trim() || !formUsername.trim() || formPassword.length < 12) { setFormError('Enter a name, username, and temporary password of at least 12 characters.'); return }
    try {
      setSubmitting(true); setFormError(null)
      await apiRequest('/v1/admin/staff', { method: 'POST', body: { name: formName.trim(), username: formUsername.trim().toLowerCase(), password: formPassword, position: formPosition } })
      setIsAddModalOpen(false); setFormName(''); setFormUsername(''); setFormPassword(''); setFormPosition('teacher')
      await loadStaff()
    } catch { setFormError('Employee account creation failed. No local placeholder was created.') }
    finally { setSubmitting(false) }
  }

  const openEdit = async (staff: StaffMember) => {
    setEditingStaff(staff); setAccess(null); setChangeReason(''); setAccessError(null)
    if (!canManageAbilities || staff.id === currentUserId) return
    try {
      setAccessLoading(true)
      const response = await apiRequest<{ data: EmployeeAccess }>(`/v1/admin/staff/${staff.id}/access`)
      setAccess(response.data); setPositionDraft(response.data.position); setPermissionDraft(response.data.permissions); setTeacherAppAccess(response.data.teacher_app_access)
    } catch { setAccessError('Unable to load this employee’s access settings.') }
    finally { setAccessLoading(false) }
  }

  const togglePermission = (slug: string, checked: boolean) => {
    if (!access) return
    setPermissionDraft((current) => {
      const next = new Set(current)
      if (checked) { next.add(slug); if (access.dependencies[slug]) next.add(access.dependencies[slug]) }
      else { next.delete(slug); Object.entries(access.dependencies).forEach(([manage, view]) => { if (view === slug) next.delete(manage) }) }
      return [...next]
    })
  }

  const saveAccess = async () => {
    if (!editingStaff || !access || !canManageAbilities) return
    if (!changeReason.trim()) { setAccessError('Enter a reason for this change. It will be recorded in Audit Trail.'); return }
    try {
      setSaving(true); setAccessError(null)
      await apiRequest(`/v1/admin/staff/${editingStaff.id}/access`, { method: 'PUT', body: { position: positionDraft, permissions: permissionDraft, teacher_app_access: teacherAppAccess, reason: changeReason.trim() } })
      setEditingStaff(null); await loadStaff()
    } catch { setAccessError('User access could not be updated. Please try again.') }
    finally { setSaving(false) }
  }

  useEffect(() => {
    if (!access || positionDraft === access.position) return
    setPermissionDraft(access.position_defaults[positionDraft] ?? [])
    setTeacherAppAccess(positionDraft === 'teacher')
  }, [access, positionDraft])

  const filteredStaff = staffList.filter((item) => {
    const needle = search.toLowerCase()
    return (item.name.toLowerCase().includes(needle) || item.username.toLowerCase().includes(needle) || item.staff_no.toLowerCase().includes(needle)) && (roleFilter === 'all' || item.roles.includes(roleFilter))
  })
  const teachersCount = staffList.filter((item) => item.roles.includes('teacher')).length

  return <section className="page-stack staff-page">
    <PageHeader eyebrow="School Human Resources" title="Employees" description="Manage the school’s Teachers, School Admins, and Finance employees." action={<button type="button" className="primary-button" onClick={() => setIsAddModalOpen(true)}><IconlyUserPlus size={16} /><span>Add Employee</span></button>} />
    <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}><StatCard label="Total Employees" value={String(staffList.length)} meta="Active employee records" /><StatCard label="Teachers" value={String(teachersCount)} meta="Teaching position" /><StatCard label="Admin & Finance" value={String(staffList.length - teachersCount)} meta="School operations" /></div>
    <DataPanel title="Employee Directory">
      <FilterToolbar ariaLabel="Employee filter toolbar"><div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%' }}><input type="text" placeholder="Search by name, ID or username..." value={search} onChange={(event) => setSearch(event.target.value)} className="search-input" style={{ flex: 1, minWidth: '200px' }} /><CustomSelect ariaLabel="Filter by position" value={roleFilter} onChange={(value) => setRoleFilter(String(value))} options={[{ value: 'all', label: 'All Positions' }, { value: 'teacher', label: 'Teacher' }, { value: 'school-admin', label: 'School Admin' }, { value: 'finance', label: 'Finance' }]} /></div></FilterToolbar>
      {loading && <p className="table-message">Loading employees...</p>}{error && <p className="table-message error-text">{error}</p>}
      {!loading && !error && <div className="table-responsive"><table className="data-table"><thead><tr><th>Staff ID</th><th>Full Name</th><th>Username</th><th>Position</th><th>Assigned Classes</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredStaff.length === 0 ? <tr><td colSpan={7} className="table-message">No employees match the selected criteria.</td></tr> : filteredStaff.map((staff) => <tr key={staff.id}><td><strong>{staff.staff_no}</strong></td><td><strong>{staff.name}</strong></td><td>@{staff.username}</td><td>{staff.role}</td><td>{staff.assigned_classes.join(', ') || '—'}</td><td><StatusBadge tone={staff.status === 'active' ? 'positive' : 'neutral'}>{staff.status.toUpperCase()}</StatusBadge></td><td><button type="button" className="table-action" onClick={() => void openEdit(staff)}><Edit3 size={15} /> Edit</button></td></tr>)}</tbody></table></div>}
    </DataPanel>
    {editingStaff && <ModalFrame title={`Edit ${editingStaff.name}`} description={`${editingStaff.staff_no} · @${editingStaff.username}`} onClose={() => setEditingStaff(null)} footer={<button type="button" className="primary-button" disabled={saving || accessLoading || editingStaff.id === currentUserId} onClick={() => void saveAccess()}>{saving ? 'Saving…' : 'Save access'}</button>}><section className="employee-access-editor"><header className="employee-access-heading"><span className="employee-access-icon"><ShieldCheck size={21} /></span><span><strong>Position & User Abilities</strong><small>Effective access for this employee. Every saved change is audited.</small></span></header>{accessError && <p className="attendance-error" role="alert">{accessError}</p>}{editingStaff.id === currentUserId ? <p className="attendance-error">For safety, you cannot change your own position or abilities.</p> : !canManageAbilities ? <p>You do not have permission to manage User Abilities.</p> : accessLoading ? <div className="app-skeleton" aria-label="Loading user abilities" /> : access && <><label className="employee-access-field"><span>Employee position</span><CustomSelect ariaLabel="Employee position" value={positionDraft} onChange={(value) => setPositionDraft(value as EmployeeAccess['position'])} options={access.positions} /></label>{Object.entries(access.groups).map(([group, items]) => <section className="ability-group" key={group}><h4>{group}</h4><div className="ability-grid">{items.map((item) => { const checked = permissionDraft.includes(item.slug); return <label className={`system-check-card${checked ? ' is-checked' : ''}`} key={item.slug}><input className="system-checkbox" type="checkbox" checked={checked} onChange={(event) => togglePermission(item.slug, event.target.checked)} /><span><strong>{item.label}</strong>{access.default_permissions.includes(item.slug) && <small>Position default</small>}</span></label> })}</div></section>)}<section className="ability-group"><h4>App</h4><label className={`system-check-card${teacherAppAccess ? ' is-checked' : ''}`}><input className="system-checkbox" type="checkbox" checked={teacherAppAccess} onChange={(event) => setTeacherAppAccess(event.target.checked)} /><span><strong>Teacher App Access</strong><small>Use the App with the Teacher persona; available tools still follow User Abilities.</small></span></label></section><label className="employee-access-field"><span>Reason for change *</span><textarea rows={3} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Example: Assigned as acting principal for Term 2." /></label></>}</section></ModalFrame>}
    {isAddModalOpen && <ModalFrame title="Add Employee Account" onClose={() => setIsAddModalOpen(false)} footer={<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setIsAddModalOpen(false)} disabled={submitting}>Cancel</button><button type="submit" form="add-employee-form" className="primary-button" disabled={submitting}>{submitting ? 'Creating...' : 'Create Employee'}</button></div>}><form id="add-employee-form" onSubmit={addEmployee} className="employee-create-form">{formError && <div className="attendance-error">{formError}</div>}<label>Full Name *<input type="text" required value={formName} onChange={(event) => setFormName(event.target.value)} /></label><label>Username *<input type="text" required value={formUsername} onChange={(event) => setFormUsername(event.target.value)} /></label><label>Position *<CustomSelect ariaLabel="New employee position" value={formPosition} onChange={(value) => setFormPosition(value as EmployeeAccess['position'])} options={[{ value: 'teacher', label: 'Teacher' }, { value: 'school-admin', label: 'School Admin' }, { value: 'finance', label: 'Finance' }]} /></label><label>Temporary Password *<input type="password" required minLength={12} autoComplete="new-password" value={formPassword} onChange={(event) => setFormPassword(event.target.value)} /><small>The position supplies defaults; User Abilities can be adjusted after creation.</small></label></form></ModalFrame>}
  </section>
}
