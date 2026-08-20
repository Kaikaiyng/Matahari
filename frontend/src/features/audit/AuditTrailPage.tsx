import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, History, X } from 'lucide-react'
import { ApiError, apiRequest } from '../../api'
import { CustomSelect, DataPanel, FilterToolbar, PageHeader } from '../../components/AdminUi'
import type { AuditLog, AuditLogDetailResponse, AuditLogListResponse } from './auditTypes'

const auditModules = [
  'authentication',
  'students',
  'fee_agreements',
  'payments',
  'receipts',
  'users',
  'reports',
  'batch',
  'legacy',
]

type AuditTrailPageProps = {
  onUnauthorized: () => void
}

export function AuditTrailPage({ onUnauthorized }: AuditTrailPageProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [module, setModule] = useState('')
  const [actorUsername, setActorUsername] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [query, setQuery] = useState('per_page=50')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const onUnauthorizedRef = useRef(onUnauthorized)
  onUnauthorizedRef.current = onUnauthorized

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await apiRequest<AuditLogListResponse>(`/audit-logs?${query}`)
        if (!cancelled) {
          setLogs(response.data)
          setNextCursor(response.meta.next_cursor)
        }
      } catch (requestError) {
        if (cancelled) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorizedRef.current()
          return
        }

        setLogs([])
        setNextCursor(null)
        setError(errorMessage(requestError))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [query])

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (module) params.set('module', module)
    if (actorUsername.trim()) params.set('actor_username', actorUsername.trim())
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    params.set('per_page', '50')
    setQuery(params.toString())
  }

  const clearFilters = () => {
    setModule('')
    setActorUsername('')
    setDateFrom('')
    setDateTo('')
    setQuery('per_page=50')
  }

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

  const openDetails = async (id: number) => {
    setError('')
    try {
      const response = await apiRequest<AuditLogDetailResponse>(`/audit-logs/${id}`)
      setSelectedLog(response.data)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorizedRef.current()
        return
      }
      setError(errorMessage(requestError))
    }
  }

  return (
    <section className="page-stack audit-trail-page">
      <PageHeader
        eyebrow="Security"
        title="Audit Trail"
        description="Review immutable authentication, student, fee agreement, payment, and receipt events."
      />

      <form onSubmit={applyFilters}>
        <FilterToolbar ariaLabel="Audit log filters">
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>Module</span>
            <CustomSelect
              ariaLabel="Module"
              value={module}
              onChange={(val) => setModule(String(val))}
              options={[
                { value: '', label: 'All modules' },
                ...auditModules.map((value) => ({ value, label: formatLabel(value) })),
              ]}
              size="compact"
            />
          </label>
          <label>
            Actor username
            <input value={actorUsername} maxLength={50} onChange={(event) => setActorUsername(event.target.value)} />
          </label>
          <label>
            From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <div className="toolbar-actions audit-filter-actions">
            <button className="primary-action compact" type="submit">Apply filters</button>
            <button className="secondary-action compact" type="button" onClick={clearFilters}>Clear</button>
          </div>
        </FilterToolbar>
      </form>

      {error && <div className="message-card error" role="alert">{error}</div>}

      <DataPanel eyebrow="Read only" title="Recorded Events">
        {isLoading ? (
          <div className="empty-state compact" role="status">Loading audit events...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state compact">
            <History size={24} />
            <strong>No audit events found</strong>
            <p>Try a wider date range or clear the filters.</p>
          </div>
        ) : (
          <>
            <p className="table-scroll-hint">Audit records are append-only and cannot be edited from this screen.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date and time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Record</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatTimestamp(log.created_at)}</td>
                      <td>{log.actor_username ?? 'System'}</td>
                      <td><code>{log.action}</code></td>
                      <td>{formatLabel(log.module)}</td>
                      <td>{log.entity_type ? `${formatLabel(log.entity_type)} #${log.entity_id ?? 'n/a'}` : 'n/a'}</td>
                      <td>
                        <button className="link-button" type="button" aria-label={`View audit event ${log.id}`} onClick={() => void openDetails(log.id)}>
                          <Eye size={16} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor && (
              <div className="audit-pagination">
                <button className="secondary-action compact" type="button" disabled={isLoadingMore} onClick={() => void loadMore()}>
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </DataPanel>

      {selectedLog && (
        <div className="modal-backdrop" role="presentation">
          <article className="audit-detail-modal" role="dialog" aria-modal="true" aria-label={`Audit event ${selectedLog.id}`}>
            <header>
              <div>
                <span>Audit event #{selectedLog.id}</span>
                <h2>{selectedLog.action}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close audit details" onClick={() => setSelectedLog(null)}>
                <X size={19} />
              </button>
            </header>
            <dl className="audit-detail-summary">
              <div><dt>Recorded</dt><dd>{formatTimestamp(selectedLog.created_at)}</dd></div>
              <div><dt>Actor</dt><dd>{selectedLog.actor_username ?? 'System'}</dd></div>
              <div><dt>Request ID</dt><dd>{selectedLog.request_id ?? 'Not available'}</dd></div>
              <div><dt>Record</dt><dd>{selectedLog.entity_type ?? 'n/a'} #{selectedLog.entity_id ?? 'n/a'}</dd></div>
              <div><dt>Reason</dt><dd>{selectedLog.reason ?? 'Not provided'}</dd></div>
              <div><dt>Route</dt><dd>{selectedLog.http_method ?? ''} {selectedLog.route_name ?? 'Not available'}</dd></div>
            </dl>
            <section className="audit-values-grid">
              <AuditValues title="Before" values={selectedLog.old_values} />
              <AuditValues title="After" values={selectedLog.new_values} />
              <AuditValues title="Metadata" values={selectedLog.metadata} />
            </section>
          </article>
        </div>
      )}
    </section>
  )
}

function AuditValues({ title, values }: { title: string; values: Record<string, unknown> }) {
  return (
    <article>
      <h3>{title}</h3>
      <pre>{Object.keys(values).length > 0 ? JSON.stringify(values, null, 2) : 'No values recorded.'}</pre>
    </article>
  )
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatTimestamp(value: string | null) {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Audit events could not be loaded. Please try again.'
}
