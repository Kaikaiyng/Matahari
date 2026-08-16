import { apiRequest } from '../../api'

export type ModerationPriority = 'normal' | 'severe'
export type ModerationDecision = 'no_violation' | 'approve' | 'reject' | 'hide' | 'warn' | 'escalate'

export interface ModerationMediaEvidence { id: number; type: string; name: string | null; mime_type: string | null; size_bytes: number | null; status: string }
export interface ModerationSnapshot {
  target_type: 'post' | 'comment' | 'user'
  reported_user_id: number
  post: { id: number; body: string; status: string; author_user_id: number; media: ModerationMediaEvidence[] } | null
  comment: { id: number; body: string; status: string; author_user_id: number } | null
}
export interface ModerationAppeal { id: number; status: string; statement: string; source_moderator_user_id: number | null; decision: string | null; decision_reason: string | null; created_at: string | null }
export interface ModerationCase {
  id: number; source: string; target_type: string; reason_code: string; priority: ModerationPriority; status: string
  due_at: string | null; overdue: boolean; target_snapshot: ModerationSnapshot; resolution_code?: string | null
  has_pending_appeal?: boolean; actions?: unknown[]; appeals?: ModerationAppeal[]
}
export interface PlatformCaseSummary { id: number; tenant_id: number; school_id: number; priority: ModerationPriority; reason_code: string; status: string; due_at: string | null; overdue: boolean }
export interface PlatformSummary { open: number; severe_open: number; overdue: number; by_tenant: Array<{ tenant_id: number; total: number }>; severe_cases: PlatformCaseSummary[] }
export type PlatformCase = ModerationCase & { tenant_id: number; school_id: number }

export const moderationApi = {
  getSchoolQueue: () => apiRequest<{ data: ModerationCase[] }>('/v1/admin/community-moderation/reports'),
  getSchoolCase: (reportId: number) => apiRequest<{ data: ModerationCase }>(`/v1/admin/community-moderation/reports/${reportId}`),
  decideSchoolCase: (reportId: number, decision: ModerationDecision, reasonCode: string, reason: string) => apiRequest<{ data: ModerationCase }>(`/v1/admin/community-moderation/reports/${reportId}/decision`, { method: 'POST', body: { decision, reason_code: reasonCode, reason } }),
  restrictCommunityUser: (userId: number, scope: 'comment' | 'publish' | 'media' | 'all', reasonCode: string, reason: string, endsAt?: string) => apiRequest<{ data: { id: number; status: string } }>(`/v1/admin/community-moderation/users/${userId}/restrictions`, { method: 'POST', body: { scope, reason_code: reasonCode, reason, ends_at: endsAt || null } }),
  decideAppeal: (appealId: number, decision: 'upheld' | 'overturned', reason: string) => apiRequest<{ data: { id: number; status: string } }>(`/v1/admin/community-moderation/appeals/${appealId}/decision`, { method: 'POST', body: { decision, reason } }),
  getPlatformSummary: () => apiRequest<{ data: PlatformSummary }>('/v1/platform/community-moderation/summary'),
  getPlatformCase: (reportId: number) => apiRequest<{ data: PlatformCase }>(`/v1/platform/community-moderation/reports/${reportId}`),
  decidePlatformCase: (reportId: number, decision: Exclude<ModerationDecision, 'escalate'>, reasonCode: string, reason: string) => apiRequest<{ data: { id: number; status: string } }>(`/v1/platform/community-moderation/reports/${reportId}/decision`, { method: 'POST', body: { decision, reason_code: reasonCode, reason } }),
}
