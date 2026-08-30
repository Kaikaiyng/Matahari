# Attendance Hub and Campus Access Design

## Objective

Create one user-friendly Attendance domain that separates campus access from class or lesson attendance. Admin has one Attendance entry point; Classes remains a roster and class-management surface with contextual links into Attendance. Parent can see and receive notifications for their reviewed linked children, Teacher access follows explicit scope and time-bound abilities, and Student has no Attendance surface.

## Information Architecture

Admin Attendance contains:

- **Overview:** current on-campus count, not arrived, late, left school, exception count, pending class registers, and device health.
- **Campus Records:** date/class/status filters and one summary row per student. `View Detail` opens the complete immutable Entry/Exit timeline.
- **Class Register:** the existing daily class register workflow, moved out of Classes. A future timetable-linked Lesson Attendance workflow extends this area without changing Campus Events.
- **Devices:** Hikvision device and reader configuration, including Entry/Exit direction and last contact state.
- **Settings:** one school-wide arrival cutoff and normal dismissal time, with notification defaults.
- **Employees > Edit > User Abilities:** checkbox-based user-specific Attendance abilities; the backend continues to preserve effective and expiry dates.

Classes owns class metadata and the active Student Roster. It does not embed a second Attendance editor. An `Open Class Register` action deep-links to Attendance with the class selected.

## Attendance Domains

### Campus Attendance

Every accepted gate interaction is an immutable event. Events support `entry` and `exit`, Face and Card authentication, multiple movements per student per day, and out-of-order arrival. The system derives First Entry, Last Exit, current on-campus state, Late, Early Leave, and anomaly flags without deleting raw history.

The summary list does not show the complete timeline. The complete timeline, device/reader source, authentication method, ingestion state, and audited manual correction are visible only in `View Detail`.

### Class and Lesson Attendance

Existing `attendance_sessions` and `attendance_records` remain the authority for the current daily class register. Campus gate events do not overwrite those records. A future timetable-linked lesson session may reuse the session model's subject, teaching assignment, start time, and session type, but timetable work is outside this implementation.

## Hikvision Boundary

The product uses a vendor-neutral Gate Event ingestion contract and a Hikvision adapter. Hikvision ISAPI event fields are normalized to an internal event containing provider event ID, device, reader, direction, occurred time, received time, credential/person reference, authentication method, access result, and a security-filtered source snapshot.

The database does not store face templates. Card identifiers are encrypted or irreversibly fingerprinted for lookup and masked for display. Device secrets are encrypted and never returned by read APIs. `device_id + provider_event_id` is the idempotency boundary so retries cannot duplicate attendance or Parent notifications.

Because device models differ, Admin maps each device reader to `entry`, `exit`, or `bidirectional`. Unknown credentials enter a school-scoped exception queue and never create or guess a Student association. Invalid authentication, inactive devices, wrong tenants, or unverified request signatures fail closed.

## School Day Rules

The first version uses one school-wide arrival cutoff and normal dismissal time configured in Admin. Late and Early Leave are derived from the school's timezone and these settings. Calendar-based special-day overrides and class-specific schedules remain future extensions.

## Authorization

Attendance uses dedicated backend permissions rather than Student CRUD permissions:

- `attendance.view_assigned`: view assigned classes and their class registers.
- `attendance.view_school`: view school-wide Campus and class Attendance.
- `attendance.manage_assigned`: take or correct assigned class/lesson Attendance.
- `attendance.manage_school`: manually add or correct school-wide Attendance.
- `attendance.devices.manage`: configure gate devices and readers.
- `attendance.abilities.manage`: grant and revoke time-bound user abilities.

User Attendance abilities are school-scoped grants with `effective_from` and nullable `expires_at`. Grants add only the named Attendance permission and do not mutate the Teacher role. Expired or future grants confer no access. Creation, revocation, and date changes are audited.

Parent access remains self-service and requires the existing reviewed same-school guardian-child relationship and academic visibility capability. Parent sees only linked children. Student receives no Attendance navigation, notification, or Attendance API response. Teacher defaults to assigned scope; whole-school viewing and management are separate abilities.

## Notifications

Every unique successful Entry and Exit creates an in-app notification for eligible reviewed Parent accounts by default. Notification creation occurs after the Campus Event is durably accepted and uses the event idempotency key, so a device retry cannot notify twice. Student receives no Attendance notification. Teacher receives no per-student gate notification by default. Admin exceptions cover unknown credentials, device health, clock skew, rejected access, and invalid Entry/Exit sequences.

## Failure and Recovery Behavior

- Duplicate provider events return the original accepted result without new events or notifications.
- Out-of-order events are preserved and the daily summary is recomputed.
- Repeated Entry, Exit without Entry, excessive clock skew, and unknown credentials are flagged rather than deleted.
- A device may report after being offline; `occurred_at` remains the business time and `received_at` records ingestion latency.
- Manual additions and corrections require a reason, preserve the original event, and write audit inside the same transaction.
- Notification delivery failure does not roll back the immutable gate event; a retryable notification record preserves delivery intent.

## Delivery Scope

This implementation will:

1. Consolidate Admin navigation and remove the duplicate Classes Attendance editor while preserving a deep link.
2. Remove Student Attendance UI/API access.
3. Introduce dedicated Attendance permissions and time-bound per-user grants.
4. Add Campus Device, Reader, Credential, Event, Exception, and School Day configuration persistence.
5. Add secure vendor-neutral ingestion plus a Hikvision-normalization boundary and local simulator payload.
6. Add Admin Overview with complete Campus Records and View Detail, plus Class Register, Devices, and Settings; place User Abilities inside each employee's Edit dialog.
7. Add Parent Campus Attendance history and default Entry/Exit notifications.

Real Hikvision connectivity, polling/listening deployment, device firmware-specific fields, external push delivery, Calendar overrides, Timetable, and timetable-linked Lesson Attendance remain **Not verified** until hardware and the later scheduling phase are available.

## Verification

Backend tests cover tenant/school isolation, dedicated permissions, grant validity windows, reviewed Parent scope, Student denial, ingestion authentication, idempotency, unknown credentials, out-of-order events, summaries, notifications, and transactional audits. Admin and App tests cover navigation, scope-specific UI, View Detail, devices/settings/abilities, Parent history, and Student removal. Relevant lint, type checking, builds, route loading, and migration/rollback checks are required; MariaDB behavior is reported separately if no disposable instance is available.
