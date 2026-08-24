import { apiRequest } from '../../api'

export type ModerationDecision = 'no_action' | 'remove_content'

type Person = { id: number; name: string }

export interface ModerationMediaEvidence {
  id: number
  type: string
  name: string | null
  mime_type: string | null
  size_bytes: number | null
  status: string
}

export interface ModerationCase {
  id: number
  source: 'user_report'
  target_type: 'post'
  reason_code: string
  priority: 'normal' | 'severe'
  status: string
  details: string | null
  created_at: string | null
  due_at: string | null
  overdue: boolean
  resolution_code?: ModerationDecision | null
  reporter: Person | null
  post: { author: Person | null; audience: { school: boolean; classes: Person[] } } | null
  target_snapshot: {
    target_type: 'post'
    reported_user_id: number
    post?: { id: number; body: string | null; status: string; author_user_id: number; media?: ModerationMediaEvidence[] } | null
  }
  actions: Array<{ id: number; action: string; reason_code: string | null; reason: string | null; actor: Person | null; created_at: string | null }>
}

export const moderationApi = {
  getSchoolQueue: () => apiRequest<{ data: ModerationCase[] }>('/v1/admin/community-moderation/reports'),
  getSchoolCase: (reportId: number) => apiRequest<{ data: ModerationCase }>(`/v1/admin/community-moderation/reports/${reportId}`),
  decideSchoolCase: (reportId: number, decision: ModerationDecision, reasonCode: string, reason: string) => apiRequest<{ data: ModerationCase }>(`/v1/admin/community-moderation/reports/${reportId}/decision`, { method: 'POST', body: { decision, reason_code: reasonCode, reason } }),
}
