# Permissions

**Status:** Seeded role matrix and verified enforcement map

**Repository baseline:** `14adce9508992c03c4249d49308a3841c198f4bd`

## Labels

- **Allowed:** The seeded role has the required permission and a backend endpoint exists.
- **Denied:** The seeded role does not have the required backend permission.
- **Limited:** A narrower related operation exists, or the capability is available only in part of the UI.
- **Not implemented:** No usable backend operation exists, even if a permission slug or placeholder appears.
- **Needs confirmation:** Approved access policy is not established.

Super Admin receives all 29 seeded permissions. The other seeded assignments are School Admin 23, Finance 16, and CEO 2. Stored slugs are `super-admin`, `school-admin`, `finance`, and `ceo`.

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
| View audit records | Not implemented | Not implemented | Not implemented | Not implemented | Super Admin has `audit.view`, but no audit route/UI uses it |
| Perform generic audit correction | Not implemented | Not implemented | Not implemented | Not implemented | Super Admin has `audit.correct_generic`, but no correction workflow exists |
| Change system settings | Not implemented | Not implemented | Not implemented | Not implemented | Settings page is a placeholder |

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
| School scope | Distributed controller/request/service checks; no global tenant middleware |
| Mutation validation | Laravel Form Requests plus service invariants |
| Frontend actions | `permissions.includes(...)` checks for many pages/buttons; not authoritative |
| Frontend navigation | Not permission-filtered; all 12 navigation items are visible to every authenticated user |

No Laravel policies are present.

## Backend Enforcement Gaps

### Legacy dashboard

`GET /api/dashboard/school` requires only `auth`. It accepts a requested `school_id` and does not compare it with the authenticated user's school. Any logged-in user can directly request data for another existing school ID.

Frontend hiding of an outstanding card for users without `fee_record.view` does not protect this endpoint.

### Legacy invoice generation

`POST /api/invoices/generate-monthly` requires only `auth`. It accepts school and actor identifiers without binding them to the authenticated user. It can write legacy invoices without a specific permission or school-scope enforcement.

These are release-blocking authorization issues.

## Frontend/Backend Mismatches

- Students navigation is always visible; the Students page initially requests protected data without checking `students.view`, relying on backend 403.
- Student Detail requests Fee Agreement history without first checking `fee_agreements.view`.
- Fee items are requested based on agreement edit rights rather than `fee_items.view`.
- The frontend shows Fee Record activation for `fee_record.generate` **or** `fee_record.manage`; the backend requires `fee_record.generate`.
- CEO can see Calendar event summaries through `calendar.view`, but the frontend does not open full event detail unless the user also has update or delete permission.
- Most payment and receipt action buttons match their backend permissions.
- Top-level Payments/Receipts navigation opens placeholders even when the user has access; implemented workflows are inside Student Detail.

Frontend mismatches should be corrected for usability, but backend checks must remain the security boundary.

## Rules for New Permissions

1. Define the business owner and approved roles.
2. Add a stable permission slug and seed assignment.
3. Enforce it on the backend route/controller/service and add unauthorized/cross-school tests.
4. Add frontend visibility only after backend enforcement exists.
5. Update this matrix and [Business Rules](business-rules.md) in the same pull request.
