export type AuditLog = {
  id: number
  event_uuid: string
  request_id: string | null
  batch_id: string | null
  school_id: number | null
  user_id: number | null
  actor_username: string | null
  actor_roles: string[]
  action: string
  module: string
  entity_type: string | null
  entity_id: number | null
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  metadata: Record<string, unknown>
  reason: string | null
  related_audit_id: number | null
  ip_address: string | null
  user_agent: string | null
  route_name: string | null
  http_method: string | null
  context_type: string
  schema_version: number
  created_at: string | null
}

export type AuditLogListResponse = {
  data: AuditLog[]
  meta: {
    per_page: number
    next_cursor: string | null
    previous_cursor: string | null
  }
}

export type AuditLogDetailResponse = {
  data: AuditLog
}
