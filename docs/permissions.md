# Permissions

**Status:** Seeded role matrix and verified enforcement map

**Repository baseline:** SaaS feature branch based on `master` at `0ad0558` (2026-08-14)

## Labels

- **Allowed:** The seeded role has the required permission and a backend endpoint exists.
- **Denied:** The seeded role does not have the required backend permission.
- **Limited:** A narrower related operation exists, or the capability is available only in part of the UI.
- **Not implemented:** No usable backend operation exists, even if a permission slug or placeholder appears.
- **Needs confirmation:** Approved access policy is not established.

Super Admin receives all seeded permissions. Stored role slugs also include `tenant-owner`, `teacher`, `parent`, and `student`; a user may hold multiple roles. Existing Finance and CEO grants remain unchanged.

Tenant requests use roles from the active `tenant_user_memberships` record, not a cross-tenant union of global roles. `tenant-owner` receives `tenant.settings.manage` for branding, pending domains, features, schools and memberships in the current tenant. Only an explicit platform owner may list/create/suspend tenants or activate domains. `super-admin` is not assignable as a tenant membership role through these APIs.

## Role Matrix

| Operation | Super Admin | School Admin | Finance | CEO | Backend permission/enforcement |
| --- | --- | --- | --- | --- | --- |
| View students | Allowed | Allowed | Allowed | Denied | `students.view` route middleware |
| Create students | Allowed | Allowed | Denied | Denied | `students.create` route middleware |
| Update student profile | Allowed | Allowed | Denied | Denied | `students.update`; backend API exists, frontend incomplete |
| Change student status | Allowed | Allowed | Denied | Denied | `students.update_status` route middleware |
| View classes/rosters | Allowed | Allowed | Allowed | Denied | Reuses `students.view`; read-only module |
| View guardian data in Student Detail | Allowed | Allowed | Allowed | Denied | Returned by student detail under `students.view`; `parents.view` is not used by a route |
| View independent parent directory | Not implemented | Not implemented | Not implemented | Not implemented | No parent list/detail API; top-level frontend is static |
| Create/update parents | Not implemented | Not implemented | Not implemented | Not implemented | Slugs exist for Super/School Admin only, but no API |
| View fee catalogue | Allowed | Allowed | Allowed | Denied | `fee_items.view`; read-only API |
| Manage fee catalogue | Not implemented | Not implemented | Not implemented | Not implemented | `fee_items.manage` is seeded only to Super Admin; no mutation API/UI |
| View Fee Agreement history | Allowed | Allowed | Allowed | Denied | `fee_agreements.view` route middleware |
| Create Fee Agreements | Allowed | Allowed | Denied | Denied | `fee_agreements.create` route middleware |
| Supersede Fee Agreements | Allowed | Allowed | Denied | Denied | `fee_agreements.update` route middleware |
| View Fee Record/summary | Allowed | Allowed | Allowed | Allowed | `fee_record.view` route middleware |
| Activate Fee Record charges | Allowed | Allowed | Denied | Denied | `fee_record.generate` route middleware |
| Create manual charges | Allowed | Allowed | Denied | Denied | `fee_record.manage` route middleware |
| View payments | Allowed | Allowed | Allowed | Denied | `payments.view` route middleware |
| Record payments | Allowed | Allowed | Denied | Denied | `payments.create` route middleware |
| Verify payments | Allowed | Denied | Allowed | Denied | `payments.verify` route middleware |
| Void payments | Allowed | Denied | Allowed | Denied | `payments.void` route middleware |
| View receipts | Allowed | Allowed | Allowed | Denied | `receipts.view` route middleware |
| Issue receipts | Allowed | Allowed | Allowed | Denied | `receipts.create` route middleware |
| Void receipts | Allowed | Denied | Allowed | Denied | `receipts.void` route middleware |
| Print receipts | Allowed | Allowed | Allowed | Denied | `receipts.print` route middleware |
| View Fee Record reports | Allowed | Allowed | Allowed | Allowed | Limited to implemented summary/category views via `fee_record.view` |
| View general reports | Not implemented | Not implemented | Not implemented | Not implemented | Top-level Reports page is a placeholder |
| Export reports | Not implemented | Not implemented | Not implemented | Not implemented | No route/service/UI |
| Calendar view | Allowed | Allowed | Allowed | Allowed | `calendar.view` route middleware |
| Calendar create/update/delete | Allowed | Allowed | Allowed | Denied | Separate `calendar.*` route middleware |
| Manage users/roles | Not implemented | Not implemented | Not implemented | Not implemented | No user-management route/service/UI |
| Reset passwords | Not implemented | Not implemented | Not implemented | Not implemented | No password-reset route; reset storage was removed |
| View audit records | Allowed | Denied | Denied | Denied | `audit.view` on read-only list/detail routes; permission-filtered Audit Trail UI |
| Perform generic audit correction | Not implemented | Not implemented | Not implemented | Not implemented | Super Admin has `audit.correct_generic`, but no correction workflow exists |
| Change system settings | Not implemented | Not implemented | Not implemented | Not implemented | Settings page is a placeholder |

Phase A permission defaults:

- Super Admin: all Phase A permissions.
- School Admin: academic year, subject, enrolment, teaching-assignment, portal-link, and foundation-role management.
- Teacher: academic-year/subject read plus `teaching_scope.view`.
- Parent: `parent.self_service`; experimental portal reads additionally require an active same-school guardian-child link and the relevant reviewed pivot capability. This is not approval of a production Parent Finance workflow.
- Student: `student.self_service` only; no student-finance permission.
- Finance and CEO: no new Phase A permissions.

Foundation role management synchronizes only `teacher`, `parent`, and `student`; it preserves existing roles such as Finance or School Admin.

`foundation_accounts.manage` also permits creation of a same-school active account with one or more foundation roles. It does not permit assigning existing administrative/finance roles, changing school ownership, deactivating accounts, or resetting passwords.

## Community App Current Access

| Role/surface | Current backend permission | Additional resource scope |
| --- | --- | --- |
| Parent self-service | `parent.self_service` | Explicit same-school user link plus active reviewed guardian-child capability per child |
| Student self-service | `student.self_service` | Explicit same-school student user link; self only; no Student Finance |
| Teacher classes/Attendance | `teaching_scope.view` | Current same-school teaching assignment and current class enrolment |
| Community read | `community.view` | Same-school school audience, Teaching Assignment class scope, linked-child current enrolment, or Student self current enrolment |
| Community publish | `community.publish` | Teacher: current assigned classes only; School/Super Admin: school, class, or direct-student audience |
| Community interaction | `community.interact` | Only posts visible to the authenticated user; comments must be enabled |
| Community moderation | `community.moderate` | School/Super Admin only; hiding requires a reason and preserves history |
| Assessment management | `assessments.manage` | Teacher: current assigned class/year/subject combinations; School/Super Admin: same-school resources |
| Schedule management | `schedule.manage` | School/Super Admin only; same-school year/class/subject/Teaching Assignment validation |
| Schedule viewing | `schedule.view` | Student current enrolment; Guardian active reviewed academic link; Teacher permission is reserved for assigned-scope UI |
| Formal Quiz management | `quizzes.manage` | Teacher owns Quiz and targets only current assigned academic-year/class/subject scope |
| School Quiz management | `quizzes.manage_school` | School/Super Admin same-school override; broad Admin UI remains future |
| Formal Quiz attempt | `quizzes.attempt` | Student self only and only when present in materialized assignment recipients |
| School-wide assessment management | `assessments.manage_school` | School/Super Admin bypass Teacher assignment scope but never school scope |
| Published assessment result | `assessments.view_published` plus portal role permission | Parent requires active reviewed academic guardian capability; Student resolves self only |
| Portal notifications | Authenticated portal user | Recipient user and school must both match |

Client entry-point checkpoint:

- Admin Panel admits only `super-admin`, `school-admin`, `finance`, and `ceo` roles. A Teacher-only, Parent-only, or Student-only account is directed to the Community App instead of receiving an unusable Admin dashboard.
- Community App admits Parent, Student, Teacher, and the derived Staff persona. Staff currently maps only from `super-admin` or `school-admin`; it does not give Finance or CEO a community-publishing identity.
- Multi-role users retain the backend permission union. The Community App role switch lists only personas actually derived from the user's stored roles.
- These client gates are usability boundaries. Backend permission middleware and resource scope remain authoritative.

The current Attendance slice deliberately reuses `teaching_scope.view`; dedicated future Attendance/Community/Assessment/Quiz permissions must be introduced only with their backend modules and tests.

## CEO Intended Versus Implemented Access

Confirmed intended context describes CEO or print-only management access. Current code grants CEO only:

- `fee_record.view`
- `calendar.view`

It does not grant receipt view/print, student view, payment view, or a general report/export permission. The current CEO role is therefore read-only but not a receipt-print role.

**Needs confirmation:** Whether the approved CEO experience should include receipt printing, selected reports, cross-school summaries, exports, or no operational data beyond Fee Record and Calendar.

## Enforcement Locations

| Concern | Current enforcement |
| --- | --- |
| Authentication | Laravel `web` session guard and `auth` middleware |
| Permission slugs | `permission:<slug>` route middleware using `EnsureUserHasPermission` |
| Role-to-permission mapping | `roles`, `permissions`, `user_roles`, `role_permissions`; seeded in `DatabaseSeeder` |
| Tenant scope | Host-resolved `TenantContext`, active tenant membership, membership roles and permitted membership schools |
| School scope | Tenant-aware legacy resolver plus `SchoolContext`/`ResolveSchoolContext` for newer modules |
| Resource policies | Phase A policies/access services enforce academic, teacher-assignment, and portal-link scope |
| Mutation validation | Laravel Form Requests plus service invariants |
| Frontend actions | `permissions.includes(...)` checks for many pages/buttons; not authoritative |
| Frontend navigation | Each visible entry declares a required permission; absent groups are removed. This is a usability layer only. |

Phase A policies are present for new foundation resources. Legacy modules retain their existing route/controller/request/service enforcement until migrated deliberately.

Portal navigation must not treat `parent.self_service`, `student.self_service`, or `teaching_scope.view` as sufficient resource authorization by itself. Each API also validates the active guardian-child, student-self, or teaching-assignment relationship and same-school ownership. Notification reads and read-state updates are restricted to the authenticated recipient and school. Daily Attendance currently reuses `teaching_scope.view` plus an active same-school assignment for Teacher writes; Parent reads additionally require `can_view_academics = true`, and Student reads resolve only the linked self record. Production Parent Finance and notification administration still require their own approved permission design.

Community uses `community.view`, `community.publish`, `community.interact`, and `community.moderate`; Staff publishing does not imply school-wide academic access, and Teacher scope remains bounded by active Teaching Assignments. Assessment uses `assessments.manage`, `assessments.manage_school`, and `assessments.view_published`. Schedule uses `schedule.manage` and `schedule.view`, with relationship/enrolment scope enforced in addition to permission middleware. Attendance continues to reuse its established scope permission. Formal Quiz uses `quizzes.manage`, `quizzes.manage_school`, and `quizzes.attempt`; Practice/AI Quiz permissions remain planned until that separately approved feature is implemented.

## Legacy Endpoint Enforcement

- `GET /api/dashboard/school` requires `fee_record.view`.
- `POST /api/invoices/generate-monthly` requires `fee_record.generate`.
- School-bound users are forced to their stored school; a global Super Admin must supply an explicit valid school.
- Invoice `created_by` comes from the authenticated actor, and a submitted class must belong to the resolved school.

Focused permission, forged-actor, missing-school, invalid-school, and cross-school tests cover these rules.

## Frontend/Backend Mismatches

- CEO can see Calendar event summaries through `calendar.view`, but the frontend does not open full event detail unless the user also has update or delete permission.
- Guardian data is embedded in Student Detail under `students.view`; the separate `parents.view` slug is used for navigation but has no parent API to enforce. Seeded roles currently grant both permissions together where student access exists, but the intended separation is **Needs confirmation**.
- Payment and receipt actions and Fee Record activation match backend slugs. Implemented payment/receipt workflows remain inside Student Detail rather than separate navigation modules.

Frontend mismatches should be corrected for usability, but backend checks must remain the security boundary.

## Rules for New Permissions

1. Define the business owner and approved roles.
2. Add a stable permission slug and seed assignment.
3. Enforce it on the backend route/controller/service and add unauthorized/cross-school tests.
4. Add frontend visibility only after backend enforcement exists.
5. Update this matrix and [Business Rules](business-rules.md) in the same pull request.
