# School Information and App Support Settings Design

**Status:** Approved direction, pending implementation

**Date:** 2026-08-30

## Objective

Extend the Admin Settings workspace with real, school-scoped School Information and App Support settings. Saved support details are exposed to the current school's App support experience. The implementation follows the owner's MAW-derived personal Admin UI pattern with RYLAY/MIS colours and does not copy automotive business fields or logic.

## Scope and Tenancy

The existing tenancy hierarchy remains authoritative: one tenant may contain multiple schools. These settings belong to the resolved current school, not tenant branding, and no duplicate tenant/school scope is introduced.

- School Information stores the institution identity and contact details used by the current school.
- App Support stores the contact channels shown to users of that school's App.
- Every read and mutation resolves the active tenant/domain and current school on the backend.
- Client-submitted tenant or school identifiers are not trusted as authorization boundaries.

## Data Model

Existing `schools` fields continue to store `name`, `address`, `phone`, and `email`. A corrective migration adds nullable typed fields for:

- `registration_number`
- `group_member_line`
- `operating_hours`

A new one-to-one `school_support_settings` table stores:

- `school_id` with a unique foreign key
- `call_phone`
- `whatsapp_phone`
- `support_email`
- `operating_hours`
- `updated_by`, nullable for migration/default compatibility
- timestamps

Support settings are kept separate because they are App-facing operational configuration rather than the school's institutional record. No Telegram, external-channel, user-binding, login, token, queue, or notification-destination fields are added.

## Authorization and Audit

A new school-scoped `school.settings.manage` permission protects mutations. It is assigned by default to Super Admin, School Admin, and Finance. Reads are available to authenticated Admin users within their resolved school so the settings workspace can show effective values; mutation controls remain permission-gated.

School Information and App Support updates execute in database transactions. Each successful update writes an Audit Trail event in the same transaction with the actor, school, changed fields, old values, new values, and a safe reason label. Audit persistence failure rolls back the settings mutation. Sensitive credentials are not part of these settings.

## API Contract

School-scoped Admin endpoints are added under the existing authenticated Admin API surface:

- `GET /api/v1/admin/settings/school-information`
- `PUT /api/v1/admin/settings/school-information`
- `GET /api/v1/admin/settings/app-support`
- `PUT /api/v1/admin/settings/app-support`

The PUT routes require `school.settings.manage`. Requests use trimmed, length-limited strings, email validation, and nullable optional fields. Responses return only the resolved current school's values.

The public host-resolved policy/support response exposes local App Support fields without authentication only when the resolved tenant has exactly one active school. A tenant domain alone cannot safely choose among multiple schools, so a multi-school tenant omits local school contacts before authentication instead of guessing. The response does not expose internal identifiers, audit metadata, or configuration from another school. Platform support and child-safety contacts remain global safety configuration and are not replaced by school support details.

## Admin Experience

The current MAW-style two-column Settings workspace gains these rail entries:

1. School Information
2. App Support
3. Branding
4. Attendance
5. Notifications
6. Users
7. Account

School Information contains:

- School name
- Registration number
- Group / member line
- Address
- Phone
- Email
- Operating hours

App Support contains:

- Call support phone number
- WhatsApp support number
- Support email address
- Support operating hours
- A live preview of the App contact choices

The forms use the established RYLAY personal Admin pattern: existing typography tokens, 16px sibling gaps, compact labels, system-styled inputs, burgundy primary actions, clear save/error states, and reduced-motion support. Read-only users see the values without active save controls.

## App Experience

The App Contact Support page uses the school-scoped public response to render available contact actions:

- Call through a `tel:` action when a call number is configured.
- WhatsApp through a normalized `wa.me` action when a WhatsApp number is configured.
- Email through a `mailto:` action when an email is configured.
- Support hours as supporting text when configured.

Unavailable channels are omitted rather than rendered as disabled or fake actions. Existing global RYLAY support and child-safety contact behavior remains available for legal/safety requirements; school support is presented as the local school contact.

## Validation and Compatibility

- Existing school records migrate without destructive changes; all new fields are nullable.
- The support row is created lazily or by update-or-create, avoiding mandatory backfill with invented contact details.
- WhatsApp numbers are stored as user-entered contact data but normalized to digits only when producing a link.
- Email values use backend email validation.
- No school profile data rewrites tenant branding, historical receipts, invoices, or financial snapshots.

## Verification

Focused backend tests cover same-school reads/updates, permissions, cross-school isolation, validation, public support output, and transactional audit persistence. Focused Admin tests cover loading, editing, saving, permission-gated controls, and preview output. Focused App tests cover conditional call, WhatsApp, email, and hours rendering. Migration rollback and relevant builds are recorded; MariaDB compatibility is marked not verified if a disposable MariaDB environment is unavailable.

## Out of Scope

- Telegram Bot or notification delivery changes
- Support tickets, live chat, CRM, queues, or outbox processing
- Per-user support routing
- Secrets, tokens, or third-party credentials
- Tenant-wide forced values that override school-specific settings
- Automotive service types, pricing, or company workflow fields
