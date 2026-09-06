import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, GraduationCap, Mail, MapPin, Phone } from 'lucide-react'
import { ApiError, apiRequest } from '../api'
import { CustomSelect, DataPanel, FilterToolbar, PageHeader, StatCard } from './AdminUi'

type ParentChild = {
  id: number
  link_id: number
  student_no: string
  name: string
  class_name: string | null
  relationship: string | null
  relationship_status: 'unreviewed' | 'active' | 'ended'
}
type ParentRecord = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  account_linked: boolean
  children: ParentChild[]
}
type DirectoryResponse = {
  data: ParentRecord[]
  meta: {
    total: number
    current_page: number
    last_page: number
    per_page: number
    can_view_students: boolean
    class_options: Array<{ id: number; name: string }>
  }
}
const relationshipLabels = { unreviewed: 'Not reviewed', active: 'Access configured', ended: 'Access ended' }
const rowStyle = { display: 'flex', flexWrap: 'wrap' as const, gap: '16px', alignItems: 'center' }

export function ParentsPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ search: '', classId: '' })
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [groupByClass, setGroupByClass] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [response, setResponse] = useState<DirectoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const onUnauthorizedRef = useRef(onUnauthorized)
  onUnauthorizedRef.current = onUnauthorized
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), per_page: '25' })
    if (filters.search) params.set('search', filters.search)
    if (filters.classId) params.set('class_id', filters.classId)
    return params.toString()
  }, [page, filters])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const load = async () => {
      try {
        const next = await apiRequest<DirectoryResponse>(`/v1/admin/parents?${query}`)
        if (!cancelled) { setResponse(next); setExpanded(new Set()) }
      } catch (failure) {
        if (cancelled) return
        setResponse(null)
        if (failure instanceof ApiError && failure.status === 401) onUnauthorizedRef.current()
        else setError(failure instanceof ApiError ? failure.message : 'Unable to load parents. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [query, refresh])

  const parents = response?.data ?? []
  const canViewStudents = response?.meta.can_view_students ?? false
  const groups = new Map<string, ParentRecord[]>()
  for (const parent of parents) {
    const classes = new Set(parent.children.map((child) => child.class_name ?? 'No linked class'))
    if (!classes.size) classes.add('No linked class')
    for (const name of classes) groups.set(name, [...(groups.get(name) ?? []), parent])
  }
  const toggle = (id: number) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setFilters((current) => ({ ...current, search: search.trim() }))
  }
  const renderParent = (parent: ParentRecord) => {
    const open = expanded.has(parent.id)
    const classes = [...new Set(parent.children.map((child) => child.class_name).filter(Boolean))]
    return <article key={parent.id} className={`parent-accordion-card ${open ? 'is-expanded' : ''}`}>
      <div className="parent-accordion-header" role="button" tabIndex={0} aria-expanded={open}
        onClick={() => toggle(parent.id)} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(parent.id) }
        }}>
        <div className="parent-avatar-badge">{parent.name.charAt(0)}</div>
        <div className="parent-header-main">
          <h3 className="parent-name">{parent.name}</h3>
          <div className="parent-meta-row">
            <span className="parent-meta-item"><Phone size={13} />{parent.phone || 'No phone recorded'}</span>
            <span className="parent-meta-item"><Mail size={13} />{parent.email || 'No email recorded'}</span>
          </div>
        </div>
        <div className="parent-header-right">
          <div className="parent-classes-preview">{classes.map((name) => <span key={name} className="parent-class-chip">{name}</span>)}</div>
          <ChevronDown className={open ? 'expanded' : ''} size={16} aria-hidden="true" />
        </div>
      </div>
      <div className={`parent-accordion-content${open ? ' expanded' : ''}`} aria-hidden={!open} inert={!open ? true : undefined}>
        <div className="parent-accordion-content-clip"><div className="parent-accordion-body">
          {parent.address && <div className="parent-address-row"><MapPin size={14} /><span>{parent.address}</span></div>}
          <p>{parent.account_linked ? 'Account linked' : 'Account not linked'}</p>
          {canViewStudents && <div className="parent-children-section">
            <span className="parent-section-title">Linked student records</span>
            {!parent.children.length && <p>No children linked.</p>}
            <div className="parent-children-grid">{parent.children.map((child) => <div key={child.link_id} className="parent-child-card">
              <div className="parent-child-left"><GraduationCap size={15} /><div>
                <strong className="parent-child-name">{child.name}</strong><span className="parent-child-id">{child.student_no}</span>
              </div></div>
              <div className="parent-child-tags">
                <span className="parent-tag class-tag">{child.class_name ?? 'Class not assigned'}</span>
                <span className="parent-tag relation-tag">{child.relationship || 'Relationship not recorded'}</span>
                <span className="parent-tag">{relationshipLabels[child.relationship_status] ?? 'Not reviewed'}</span>
              </div>
            </div>)}</div>
          </div>}
        </div></div>
      </div>
    </article>
  }

  return <section className="page-stack parents-page">
    <PageHeader eyebrow="School Directory" title="Parent & Guardian Directory"
      description="School contacts and recorded family relationships. Account links and child access are managed separately."
      action={<button type="button" className="secondary-action" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</button>} />
    {response && !loading && !error && <div className="stat-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
      <StatCard label="Matching Parents" value={String(response.meta.total)} meta="Across all result pages" />
      <StatCard label="Contacts on This Page" value={String(parents.length)} meta="Up to 25 contacts per page" />
    </div>}
    <FilterToolbar ariaLabel="Parent Filter Toolbar">
      <form onSubmit={submitSearch} style={rowStyle}>
        <input aria-label="Search parents" placeholder="Search name, email or phone" value={search} maxLength={150} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit" className="primary-action compact" disabled={loading}>Search</button>
        {canViewStudents && <CustomSelect ariaLabel="Filter by profile class" value={filters.classId} disabled={loading}
          onChange={(value) => { setPage(1); setFilters((current) => ({ ...current, classId: value })) }}
          options={[{ value: '', label: 'All profile classes' }, ...(response?.meta.class_options ?? []).map((item) => ({ value: String(item.id), label: item.name }))]} />}
      </form>
      {canViewStudents && <button type="button" className="secondary-action" aria-pressed={groupByClass} onClick={() => setGroupByClass((current) => !current)}>Group by profile class</button>}
    </FilterToolbar>
    {loading ? <p role="status">Loading parents...</p> : error ? <div role="alert" className="message-card error">
      <p>{error}</p><button type="button" className="secondary-action" onClick={() => setRefresh((value) => value + 1)}>Retry</button>
    </div> : response && <>
      {!canViewStudents && <p className="permission-note">Student details require Students View access.</p>}
      {canViewStudents && <p className="permission-note">Classes shown are profile classes. Relationship history does not confirm current academic-year enrolment or App access.</p>}
      {!parents.length ? <div className="empty-state"><strong>No matching parents found</strong><p>Adjust your search or class filter.</p></div>
        : groupByClass && canViewStudents ? [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => (
          <DataPanel key={name} title={name} eyebrow="Contacts on this result page"><div className="parent-cards-container">{items.map(renderParent)}</div></DataPanel>
        )) : <DataPanel title="All Parent Contacts"><div className="parent-cards-container">{parents.map(renderParent)}</div></DataPanel>}
      {response.meta.total > 0 && <nav style={rowStyle} aria-label="Parent directory pages">
        <button type="button" className="secondary-action" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {response.meta.current_page} of {response.meta.last_page}</span>
        <button type="button" className="secondary-action" disabled={page >= response.meta.last_page} onClick={() => setPage((current) => current + 1)}>Next</button>
      </nav>}
    </>}
  </section>
}
