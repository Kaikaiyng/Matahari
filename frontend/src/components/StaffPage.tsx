import React, { useEffect, useState, useCallback } from 'react'
import { IconlyUserPlus } from './icons/IconlyIcons'
import { apiRequest } from '../api'
import {
  CustomSelect,
  DataPanel,
  FilterToolbar,
  ModalFrame,
  PageHeader,
  StatCard,
  StatusBadge,
} from './AdminUi'

export interface StaffMember {
  id: number
  staff_no: string
  name: string
  username: string
  role: string
  roles: string[]
  status: string
  assigned_classes: string[]
  created_at?: string
}

export const StaffPage: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await apiRequest<{ data: StaffMember[] }>('/v1/admin/staff')
      setStaffList(resp.data ?? [])
    } catch {
      setStaffList([])
      setError('Unable to load staff records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formUsername.trim() || formPassword.length < 12) {
      setFormError('Enter a name, username, and temporary password of at least 12 characters.')
      return
    }

    try {
      setSubmitting(true)
      setFormError(null)
      await apiRequest('/v1/admin/staff', {
        method: 'POST',
        body: {
          name: formName.trim(),
          username: formUsername.trim().toLowerCase(),
          password: formPassword,
        },
      })
      setIsAddModalOpen(false)
      setFormName('')
      setFormUsername('')
      setFormPassword('')
      await loadStaff()
    } catch {
      setFormError('Teacher account creation failed. No local placeholder was created.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredStaff = staffList.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.username.toLowerCase().includes(search.toLowerCase()) ||
      item.staff_no.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || item.role.toLowerCase().includes(roleFilter.toLowerCase())
    return matchesSearch && matchesRole
  })

  const totalStaff = staffList.length
  const teachersCount = staffList.filter((s) => s.role.toLowerCase().includes('teacher')).length
  const adminCount = totalStaff - teachersCount

  return (
    <section className="page-stack staff-page">
      <PageHeader
        eyebrow="School Human Resources"
        title="Staff & Employees"
        description="Manage school teachers, administrators, finance officers, and staff records."
        action={
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsAddModalOpen(true)}
          >
            <IconlyUserPlus size={16} />
            <span>Add Teacher</span>
          </button>
        }
      />

      <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Staff" value={totalStaff.toString()} meta="Active employee records" />
        <StatCard label="Teaching Staff" value={teachersCount.toString()} meta="Teachers & Instructors" />
        <StatCard label="Admin & Support" value={adminCount.toString()} meta="Management & Finance" />
      </div>

      <DataPanel
        title="Employee Directory"
      >
        <FilterToolbar ariaLabel="Staff Filter Toolbar">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
            <input
              type="text"
              placeholder="Search staff by name, ID or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1, minWidth: '200px' }}
            />
            <CustomSelect
              ariaLabel="Filter by role"
              value={roleFilter}
              onChange={(val) => setRoleFilter(String(val))}
              options={[
                { value: 'all', label: 'All Roles' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'admin', label: 'School Admin' },
                { value: 'finance', label: 'Finance' },
              ]}
            />
          </div>
        </FilterToolbar>

        {loading && <p style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading employees...</p>}
        {error && <p style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>{error}</p>}

        {!loading && !error && (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px' }}>Staff ID</th>
                  <th style={{ padding: '12px' }}>Full Name</th>
                  <th style={{ padding: '12px' }}>Username</th>
                  <th style={{ padding: '12px' }}>Role / Designation</th>
                  <th style={{ padding: '12px' }}>Assigned Classes</th>
                  <th style={{ padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No staff members match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => (
                    <tr key={staff.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#334155' }}>{staff.staff_no}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{staff.name}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>@{staff.username}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: staff.role.toLowerCase().includes('admin') ? '#f3e8ff' : staff.role.toLowerCase().includes('finance') ? '#e0f2fe' : '#f1f5f9',
                          color: staff.role.toLowerCase().includes('admin') ? '#6b21a8' : staff.role.toLowerCase().includes('finance') ? '#0369a1' : '#334155',
                          padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700
                        }}>
                          {staff.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#475569' }}>
                        {staff.assigned_classes.length > 0 ? staff.assigned_classes.join(', ') : '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <StatusBadge tone={staff.status === 'active' ? 'positive' : 'neutral'}>
                          {staff.status.toUpperCase()}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <ModalFrame
          title="Add Teacher Account"
          onClose={() => setIsAddModalOpen(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-employee-form"
                className="primary-button"
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Create Teacher'}
              </button>
            </div>
          }
        >
          <form id="add-employee-form" onSubmit={handleAddEmployee} style={{ display: 'grid', gap: '14px', padding: '16px' }}>
            {formError && (
              <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                {formError}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mrs. Sarah Jenkins"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                Username *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. sjenkins"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label htmlFor="teacher-password" style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                Temporary Password *
              </label>
              <input
                id="teacher-password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
              <small style={{ color: '#64748b' }}>Teacher role only. Administrative and Finance role assignment remains outside this workflow.</small>
            </div>
          </form>
        </ModalFrame>
      )}
    </section>
  )
}
