import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, AlertCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, ServerCrash } from 'lucide-react'
import { ApiError, apiRequest } from '../../api'
import { DataPanel, FilterToolbar, PageHeader, StatCard } from '../../components/AdminUi'
import './ApplicationLogsPage.css'

type LogLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO'

type ApplicationLog = {
  id: string
  timestamp: string
  level: LogLevel
  environment: string
  message: string
  context: Record<string, unknown>
  actor: string | null
  ip_address: string | null
  source: string
}

type ApplicationLogResponse = {
  data: ApplicationLog[]
  meta: {
    page: number
    per_page: number
    total: number
    total_pages: number
    level_counts: Record<LogLevel, number>
    truncated: boolean
  }
}

const emptyMeta: ApplicationLogResponse['meta'] = {
  page: 1,
  per_page: 50,
  total: 0,
  total_pages: 1,
  level_counts: { FATAL: 0, ERROR: 0, WARN: 0, INFO: 0 },
  truncated: false,
}

export function ApplicationLogsPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [logs, setLogs] = useState<ApplicationLog[]>([])
  const [meta, setMeta] = useState(emptyMeta)
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filters, setFilters] = useState({ search: '', level: '', dateFrom: '', dateTo: '' })
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const onUnauthorizedRef = useRef(onUnauthorized)
  onUnauthorizedRef.current = onUnauthorized

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.level) params.set('level', filters.level)
    if (filters.dateFrom) params.set('date_from', filters.dateFrom)
    if (filters.dateTo) params.set('date_to', filters.dateTo)
    params.set('page', String(page))
    params.set('per_page', '50')
    return params.toString()
  }, [filters, page])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await apiRequest<ApplicationLogResponse>(`/application-logs?${query}`)
        if (!cancelled) {
          setLogs(response.data)
          setMeta(response.meta)
          setExpandedId(null)
        }
      } catch (caught) {
        if (cancelled) return
        if (caught instanceof ApiError && caught.status === 401) {
          onUnauthorizedRef.current()
          return
        }
        setLogs([])
        setMeta(emptyMeta)
        setError(caught instanceof ApiError ? caught.message : 'Application logs could not be loaded. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [query, refreshKey])

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setFilters({ search: search.trim(), level, dateFrom, dateTo })
  }

  const clearFilters = () => {
    setSearch('')
    setLevel('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setFilters({ search: '', level: '', dateFrom: '', dateTo: '' })
  }

  return (
    <section className="page-stack application-logs-page">
      <PageHeader
        eyebrow="System operations"
        title="Application Logs"
        description="Review sanitized runtime errors and warnings. Business changes remain in Audit Trail."
        action={<button className="secondary-action compact" type="button" aria-label="Refresh logs" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>}
      />

      <div className="application-log-stats" aria-label="Application log summary">
        <StatCard label="Fatal" value={meta.level_counts.FATAL} tone="danger" icon={<ServerCrash size={18} />} />
        <StatCard label="Errors" value={meta.level_counts.ERROR} tone="danger" icon={<AlertCircle size={18} />} />
        <StatCard label="Warnings" value={meta.level_counts.WARN} tone="warning" icon={<AlertTriangle size={18} />} />
        <StatCard label="Total matching" value={meta.total} icon={<Activity size={18} />} />
      </div>

      <form onSubmit={applyFilters}>
        <FilterToolbar ariaLabel="Application log filters">
          <label>
            Search logs
            <input value={search} maxLength={120} placeholder="Message, actor, environment…" onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            Level
            <select value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="">All levels</option>
              <option value="FATAL">Fatal</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </label>
          <label>
            From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <div className="toolbar-actions application-log-filter-actions">
            <button className="primary-action compact" type="submit">Apply filters</button>
            <button className="secondary-action compact" type="button" onClick={clearFilters}>Clear</button>
          </div>
        </FilterToolbar>
      </form>

      {error && <div className="message-card error" role="alert">{error}</div>}

      <DataPanel eyebrow="Read only · sanitized" title="Runtime Events">
        {isLoading ? (
          <div className="empty-state compact" role="status">Loading application logs...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state compact"><Activity size={24} /><strong>No log entries found</strong><p>Try a wider date range or clear the filters.</p></div>
        ) : (
          <>
            <p className="table-scroll-hint">Sensitive context is removed by the server before this page receives it.</p>
            <div className="table-wrap application-log-table-wrap">
              <table>
                <thead><tr><th>Timestamp</th><th>Level</th><th>Message</th><th>Environment</th><th>Actor / IP</th><th><span className="sr-only">Details</span></th></tr></thead>
                <tbody>
                  {logs.map((log) => (
                    <LogRows key={log.id} log={log} expanded={expandedId === log.id} onToggle={() => setExpandedId((current) => current === log.id ? null : log.id)} />
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="application-log-pagination">
              <span>Showing {logs.length} of {meta.total} entries</span>
              <div>
                <button type="button" aria-label="Previous page" disabled={meta.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button>
                <strong>{meta.page} / {meta.total_pages}</strong>
                <button type="button" aria-label="Next page" disabled={meta.page >= meta.total_pages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button>
              </div>
            </footer>
          </>
        )}
      </DataPanel>
    </section>
  )
}

function LogRows({ log, expanded, onToggle }: { log: ApplicationLog; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`application-log-row level-${log.level.toLowerCase()}`}>
        <td className="application-log-time">{formatTimestamp(log.timestamp)}</td>
        <td><span className={`application-log-level level-${log.level.toLowerCase()}`}>{log.level}</span></td>
        <td className="application-log-message">{log.message}</td>
        <td><code>{log.environment}</code></td>
        <td><strong>{log.actor ?? 'System'}</strong>{log.ip_address && <small>{log.ip_address}</small>}</td>
        <td><button className="application-log-expand" type="button" aria-label={expanded ? 'Collapse log details' : 'Expand log details'} aria-expanded={expanded} onClick={onToggle}><ChevronDown className={expanded ? 'expanded' : ''} size={17} /></button></td>
      </tr>
      {expanded && <tr className="application-log-context"><td colSpan={6}><span>Sanitized context · {log.source}</span><pre>{JSON.stringify(log.context, null, 2)}</pre></td></tr>}
    </>
  )
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
