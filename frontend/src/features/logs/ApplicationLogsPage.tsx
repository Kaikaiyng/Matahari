import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, AlertCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Copy, FileText, Fingerprint, RefreshCw, Search, ServerCrash, Zap } from 'lucide-react'
import { ApiError, apiRequest } from '../../api'
import { DatePicker } from '../../components/AdminUi'
import '../../components/OperationalPage.css'
import './ApplicationLogsPage.css'

type LogLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO'
type ApplicationLog = { id: string; timestamp: string; level: LogLevel; environment: string; message: string; context: Record<string, unknown>; actor: string | null; ip_address: string | null; source: string }
type ApplicationLogResponse = { data: ApplicationLog[]; meta: { page: number; per_page: number; total: number; total_pages: number; level_counts: Record<LogLevel, number>; truncated: boolean } }

const emptyMeta: ApplicationLogResponse['meta'] = { page: 1, per_page: 50, total: 0, total_pages: 1, level_counts: { FATAL: 0, ERROR: 0, WARN: 0, INFO: 0 }, truncated: false }
const levels: Array<{ value: '' | LogLevel; label: string; icon: typeof Activity }> = [{ value: '', label: 'All levels', icon: Activity }, { value: 'FATAL', label: 'Fatal', icon: ServerCrash }, { value: 'ERROR', label: 'Error', icon: AlertCircle }, { value: 'WARN', label: 'Warn', icon: AlertTriangle }, { value: 'INFO', label: 'Info', icon: Activity }]

export function ApplicationLogsPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [logs, setLogs] = useState<ApplicationLog[]>([])
  const [meta, setMeta] = useState(emptyMeta)
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<'' | LogLevel>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filters, setFilters] = useState({ search: '', level: '' as '' | LogLevel, dateFrom: '', dateTo: '' })
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
    params.set('page', String(page)); params.set('per_page', '50')
    return params.toString()
  }, [filters, page])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true); setError('')
      try {
        const response = await apiRequest<ApplicationLogResponse>(`/application-logs?${query}`)
        if (!cancelled) { setLogs(response.data); setMeta(response.meta); setExpandedId(null) }
      } catch (caught) {
        if (cancelled) return
        if (caught instanceof ApiError && caught.status === 401) { onUnauthorizedRef.current(); return }
        setLogs([]); setMeta(emptyMeta); setError(caught instanceof ApiError ? caught.message : 'Application logs could not be loaded. Please try again.')
      } finally { if (!cancelled) setIsLoading(false) }
    }
    void load(); return () => { cancelled = true }
  }, [query, refreshKey])

  const applyFilters = (event: FormEvent) => { event.preventDefault(); setPage(1); setFilters({ search: search.trim(), level, dateFrom, dateTo }) }
  const changeLevel = (next: '' | LogLevel) => { setLevel(next); setPage(1); setFilters((current) => ({ ...current, level: next })) }
  const clearFilters = () => { setSearch(''); setLevel(''); setDateFrom(''); setDateTo(''); setPage(1); setFilters({ search: '', level: '', dateFrom: '', dateTo: '' }) }
  const environments = [...new Set(logs.map((log) => log.environment).filter(Boolean))]
  const sources = [...new Set(logs.map((log) => log.source).filter(Boolean))]

  return <section className="page-stack application-logs-page">
    <header className="operational-page-header"><div className="operational-page-heading"><span className="operational-page-icon log-header-icon"><FileText size={20} /></span><div><h2>Application Logs</h2><p>Server-side errors, warnings and sanitized technical diagnostics.</p></div></div><div className="operational-page-actions"><button className="secondary-action compact" type="button" aria-label="Refresh logs" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={15} /> Refresh</button><span className="super-admin-badge"><Fingerprint size={14} /> Super Admin only</span></div></header>

    <section className="log-engine-panel" aria-label="Log reader status"><header><span><Zap size={15} /> Log reader & source</span><b className={error ? 'offline' : ''}>{error ? 'Reader unavailable' : 'Reader active'}</b></header><div className="log-engine-grid"><LogFact label="Environment" value={environments.join(', ') || 'No entries'} /><LogFact label="Source files" value={sources.join(', ') || 'No entries'} /><LogFact label="Matching entries" value={String(meta.total)} /><LogFact label="Page size" value={String(meta.per_page)} /><LogFact label="Read window" value={meta.truncated ? 'Truncated' : 'Complete'} /></div></section>

    <div className="log-level-tabs" aria-label="Log level filters">{levels.map((item) => { const Icon = item.icon; const count = item.value ? meta.level_counts[item.value] : meta.total; return <button key={item.label} type="button" className={`${filters.level === item.value ? 'active' : ''} ${item.value ? `level-${item.value.toLowerCase()}` : ''}`} aria-pressed={filters.level === item.value} onClick={() => changeLevel(item.value)}><Icon size={14} /> {item.label}<span>{count}</span></button> })}</div>

    <form className="application-log-filter-panel" aria-label="Application log filters" onSubmit={applyFilters}><label className="application-log-search"><span className="sr-only">Search logs</span><Search size={16} /><input aria-label="Search logs" value={search} maxLength={120} placeholder="Search error message, endpoint, IP, user…" onChange={(event) => setSearch(event.target.value)} /></label><DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" ariaLabel="From date" /><DatePicker min={dateFrom || undefined} value={dateTo} onChange={setDateTo} placeholder="To date" ariaLabel="To date" /><div className="application-log-filter-actions"><button className="primary-action compact" type="submit" aria-label="Apply filters">Apply</button><button className="secondary-action compact" type="button" onClick={clearFilters}>Clear</button></div></form>

    {error && <div className="message-card error" role="alert">{error}</div>}
    <section className="application-log-table-panel" aria-label="Runtime log entries"><div className="table-wrap application-log-table-wrap"><table><thead><tr><th>Timestamp</th><th>Level</th><th>Log message</th><th>Source</th><th>Actor / IP</th><th><span className="sr-only">Inspect</span></th></tr></thead><tbody>{isLoading ? <tr><td colSpan={6}><div className="empty-state compact" role="status">Loading application logs...</div></td></tr> : logs.length === 0 ? <tr><td colSpan={6}><div className="empty-state compact"><strong>No log entries found</strong><p>Try a wider date range or clear the filters.</p></div></td></tr> : logs.map((log) => <LogRows key={log.id} log={log} expanded={expandedId === log.id} onToggle={() => setExpandedId((current) => current === log.id ? null : log.id)} />)}</tbody></table></div>
      {!isLoading && logs.length > 0 && <footer className="application-log-pagination"><span>Showing {logs.length} of {meta.total} entries · server sanitized</span><div><button type="button" aria-label="Previous page" disabled={meta.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><strong>{meta.page} / {meta.total_pages}</strong><button type="button" aria-label="Next page" disabled={meta.page >= meta.total_pages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></footer>}
    </section>
  </section>
}

function LogFact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }

function LogRows({ log, expanded, onToggle }: { log: ApplicationLog; expanded: boolean; onToggle: () => void }) {
  const raw = { message: log.message, context: log.context, environment: log.environment, source: log.source, actor: log.actor, ip_address: log.ip_address }
  return <><tr className={`application-log-row level-${log.level.toLowerCase()}`}><td className="application-log-time">{formatTimestamp(log.timestamp)}</td><td><span className={`application-log-level level-${log.level.toLowerCase()}`}>{log.level}</span></td><td className="application-log-message">{log.message}</td><td><code>{log.source}</code><small>{log.environment}</small></td><td><strong>{log.actor ?? 'System'}</strong>{log.ip_address && <small>{log.ip_address}</small>}</td><td><button className="application-log-expand" type="button" aria-label={expanded ? 'Collapse log details' : 'Expand log details'} aria-expanded={expanded} onClick={onToggle}><ChevronDown className={expanded ? 'expanded' : ''} size={17} /></button></td></tr>{expanded && <tr className="application-log-context"><td colSpan={6}><article><header><span>Context & payload inspector · {formatTimestamp(log.timestamp)}</span><button type="button" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(raw, null, 2))}><Copy size={14} /> Copy raw log</button></header><pre>{JSON.stringify(raw, null, 2)}</pre></article></td></tr>}</>
}

function formatTimestamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
