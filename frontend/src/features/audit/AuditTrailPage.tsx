import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Activity, CalendarDays, ChevronDown, Copy, Fingerprint, Search, ShieldCheck, UserRound } from 'lucide-react'
import { ApiError, apiRequest } from '../../api'
import { CustomSelect, StatCard } from '../../components/AdminUi'
import '../../components/OperationalPage.css'
import type { AuditLog, AuditLogListResponse, AuditSummary } from './auditTypes'
import './AuditTrailPage.css'

const auditModules = ['authentication', 'students', 'fee_agreements', 'fee_record', 'payments', 'receipts', 'users', 'reports', 'batch', 'academics', 'portal_access', 'community', 'tenancy', 'legacy']
const auditSubjects = ['student', 'fee_agreement', 'fee_record_charge', 'payment', 'receipt', 'user', 'report', 'batch', 'academic_year', 'subject', 'class_enrolment', 'teaching_assignment', 'guardian', 'student_parent_link', 'attendance_session', 'user_attendance_ability', 'campus_attendance_event', 'attendance_device', 'attendance_setting', 'community_post', 'community_comment', 'community_policy_acceptance', 'community_report', 'assessment', 'academic_term', 'class_schedule_entry', 'quiz', 'quiz_assignment', 'quiz_attempt', 'tenant', 'tenant_domain']
const emptySummary: AuditSummary = { total: 0, today: 0, active_actors_30_days: 0, security_admin: 0 }

type Filters = { search: string; module: string; entityType: string; actorUsername: string; dateRange: string }
const emptyFilters: Filters = { search: '', module: '', entityType: '', actorUsername: '', dateRange: '30' }

export function AuditTrailPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const onUnauthorizedRef = useRef(onUnauthorized)
  onUnauthorizedRef.current = onUnauthorized
  const query = useMemo(() => buildQuery(filters), [filters])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await apiRequest<AuditLogListResponse>(`/audit-logs?${query}`)
        if (!cancelled) {
          setLogs(response.data)
          setSummary(response.meta.summary ?? emptySummary)
          setNextCursor(response.meta.next_cursor)
          setExpandedId(null)
        }
      } catch (requestError) {
        if (cancelled) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorizedRef.current()
          return
        }
        setLogs([])
        setSummary(emptySummary)
        setNextCursor(null)
        setError(errorMessage(requestError))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [query])

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    setFilters({ ...draft, search: draft.search.trim(), actorUsername: draft.actorUsername.trim() })
  }
  const clearFilters = () => { setDraft(emptyFilters); setFilters(emptyFilters) }

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    setError('')
    try {
      const response = await apiRequest<AuditLogListResponse>(`/audit-logs?${query}&cursor=${encodeURIComponent(nextCursor)}`)
      setLogs((current) => [...current, ...response.data])
      setNextCursor(response.meta.next_cursor)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorizedRef.current()
        return
      }
      setError(errorMessage(requestError))
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <section className="page-stack audit-trail-page">
      <OperationalHeader icon={<ShieldCheck size={20} />} title="Audit Trail" description="Detailed change history and security activity for Matahari." />

      <div className="audit-summary" aria-label="Audit Trail summary">
        <StatCard label="Total events" value={summary.total} icon={<Activity size={18} />} meta="Complete recorded history" />
        <StatCard label="Today's activity" value={summary.today} icon={<CalendarDays size={18} />} meta="Events recorded today" />
        <StatCard label="Active actors · 30 days" value={summary.active_actors_30_days} tone="positive" icon={<UserRound size={18} />} meta="Unique recorded actors" />
        <StatCard label="Security & admin" value={summary.security_admin} icon={<ShieldCheck size={18} />} meta="Protected system events" />
      </div>

      <form className="audit-filter-panel" aria-label="Audit log filters" onSubmit={applyFilters}>
        <label className="audit-search-field"><span className="sr-only">Search audit trail</span><Search size={16} aria-hidden="true" /><input aria-label="Search audit trail" value={draft.search} maxLength={120} placeholder="Search action, record, actor, IP…" onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} /></label>
        <CustomSelect ariaLabel="Module" value={draft.module} onChange={(value) => setDraft((current) => ({ ...current, module: String(value) }))} options={[{ value: '', label: 'All categories' }, ...auditModules.map((value) => ({ value, label: formatLabel(value) }))]} size="compact" />
        <CustomSelect ariaLabel="Entity type" value={draft.entityType} onChange={(value) => setDraft((current) => ({ ...current, entityType: String(value) }))} options={[{ value: '', label: 'All entity types' }, ...auditSubjects.map((value) => ({ value, label: formatLabel(value) }))]} size="compact" />
        <label className="audit-actor-field"><span className="sr-only">Actor username</span><input aria-label="Actor username" value={draft.actorUsername} maxLength={50} placeholder="All actors" onChange={(event) => setDraft((current) => ({ ...current, actorUsername: event.target.value }))} /></label>
        <CustomSelect ariaLabel="Date range" value={draft.dateRange} onChange={(value) => setDraft((current) => ({ ...current, dateRange: String(value) }))} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '', label: 'All retained' }]} size="compact" />
        <div className="audit-filter-buttons"><button className="primary-action compact" type="submit" aria-label="Apply filters">Apply</button><button className="secondary-action compact" type="button" onClick={clearFilters}>Clear</button></div>
      </form>

      {error && <div className="message-card error" role="alert">{error}</div>}
      <section className="audit-table-panel" aria-label="Recorded audit events">
        <div className="table-wrap audit-table-wrap"><table><thead><tr><th>Timestamp</th><th>Actor & role</th><th>Action</th><th>Record identifier</th><th>Category</th><th><span className="sr-only">Inspect</span></th></tr></thead><tbody>
          {isLoading ? <tr><td colSpan={6}><div className="empty-state compact" role="status">Loading audit events...</div></td></tr> : logs.length === 0 ? <tr><td colSpan={6}><div className="empty-state compact"><strong>No audit events found</strong><p>Try a wider date range or clear the filters.</p></div></td></tr> : logs.map((log) => <AuditRows key={log.id} log={log} expanded={expandedId === log.id} onToggle={() => setExpandedId((current) => current === log.id ? null : log.id)} />)}
        </tbody></table></div>
        {!isLoading && logs.length > 0 && <footer className="audit-table-footer"><span>Showing {logs.length} event{logs.length === 1 ? '' : 's'} · append-only</span>{nextCursor && <button className="secondary-action compact" type="button" disabled={isLoadingMore} onClick={() => void loadMore()}>{isLoadingMore ? 'Loading…' : 'Load more'}</button>}</footer>}
      </section>
    </section>
  )
}

export function OperationalHeader({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <header className="operational-page-header"><div className="operational-page-heading"><span className="operational-page-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div><div className="operational-page-actions">{action}<span className="super-admin-badge"><Fingerprint size={14} /> Super Admin only</span></div></header>
}

function AuditRows({ log, expanded, onToggle }: { log: AuditLog; expanded: boolean; onToggle: () => void }) {
  const payload = { before: log.old_values, after: log.new_values, metadata: log.metadata }
  return <>
    <tr className="audit-event-row"><td className="audit-time">{formatTimestamp(log.created_at)}</td><td><strong>{log.actor_username ?? 'System'}</strong><small>{formatRoles(log.actor_roles)}{log.ip_address ? ` · ${log.ip_address}` : ''}</small></td><td><span className="audit-action-badge">{formatLabel(log.action)}</span><small>{log.reason ?? `${formatLabel(log.module)} activity`}</small></td><td><span className="audit-record-type">{log.entity_type ? formatLabel(log.entity_type) : 'System'}</span><small>{log.entity_id ? `#${log.entity_id}` : log.request_id ?? 'No record ID'}</small></td><td><span className={`audit-category category-${log.module}`}>{formatLabel(log.module)}</span></td><td><button className="audit-expand" type="button" aria-label={expanded ? `Collapse audit event ${log.id}` : `View audit event ${log.id}`} aria-expanded={expanded} onClick={onToggle}><ChevronDown className={expanded ? 'expanded' : ''} size={17} /></button></td></tr>
    {expanded && <tr className="audit-detail-row"><td colSpan={6}><article className="audit-inline-detail" aria-label={`Audit event ${log.id}`}><header><span>Event #{log.id} · <code>{log.action}</code> · {formatTimestamp(log.created_at)}</span><button type="button" className="secondary-action compact" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(payload, null, 2))}><Copy size={14} /> Copy payload</button></header><div className="audit-detail-layout"><div className="audit-context-cards"><section><strong>Actor context</strong><p>User: {log.actor_username ?? 'System'}{log.user_id ? ` (ID: ${log.user_id})` : ''}</p><p>Role: {formatRoles(log.actor_roles)}</p><p>IP address: {log.ip_address ?? 'Not recorded'}</p></section><section><strong>Target entity</strong><p>Module: {formatLabel(log.module)} / {log.entity_type ? formatLabel(log.entity_type) : 'System'}</p><p>Identifier: {log.entity_id ?? 'Not recorded'}</p><p>Route: {log.http_method ?? ''} {log.route_name ?? 'Not recorded'}</p><p>Browser: {log.user_agent ?? 'Not recorded'}</p></section></div><section className="audit-payload"><strong>Sanitized request payload</strong><pre>{JSON.stringify(payload, null, 2)}</pre></section></div></article></td></tr>}
  </>
}

function buildQuery(filters: Filters) {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.module) params.set('module', filters.module)
  if (filters.entityType) params.set('entity_type', filters.entityType)
  if (filters.actorUsername) params.set('actor_username', filters.actorUsername)
  if (filters.dateRange) { const from = new Date(); from.setDate(from.getDate() - Number(filters.dateRange)); params.set('date_from', from.toISOString().slice(0, 10)) }
  params.set('per_page', '50')
  return params.toString()
}

function formatRoles(roles: string[]) { return roles.length ? roles.map(formatLabel).join(', ') : 'System' }
function formatLabel(value: string) { return value.replaceAll(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formatTimestamp(value: string | null) { if (!value) return 'Not available'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
function errorMessage(error: unknown) { return error instanceof ApiError ? error.message : 'Audit events could not be loaded. Please try again.' }
