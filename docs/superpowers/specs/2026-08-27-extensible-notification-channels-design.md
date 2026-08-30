# Extensible Notification Channels Design

**Date:** 2026-08-27
**Status:** Approved design; implementation pending

## Objective

Make notification production code channel-neutral while preserving the current in-app experience. The foundation must allow a later Telegram adapter for RYLAY operations, Super Admin and technical alerts, plus optional tenant- or school-admin groups. This delivery does not send Telegram messages and does not introduce Telegram credentials, login, user binding, queues, outbox records or configuration UI.

## Existing Constraints

- `portal_notifications` is the current user-addressed in-app notification store and owns read state.
- Current producers create these records directly from Attendance, Billing and Community services.
- RYLAY has a real hierarchy: one tenant can contain multiple schools. Tenant and school are not interchangeable.
- Notification creation currently participates in the surrounding business transaction. Existing rollback behavior must be preserved.
- Backend tenant and school enforcement remains authoritative; frontend visibility is not authorization.

## Architecture

### Standard message

Introduce an immutable `NotificationMessage` value object containing:

- notification type;
- title and body;
- optional context data;
- optional tenant ID;
- optional school ID.

The message carries content and scope, not transport-specific fields.

### Targets

Targets remain separate from messages:

- `InAppRecipient` identifies an existing RYLAY user for the `in_app` channel.
- `NotificationDestination` represents a non-user external destination. It is never interpreted as a RYLAY user account.

No Telegram-specific target, user binding or authentication model will be added.

### Channel contract and dispatcher

Add a `NotificationChannelContract` with a stable channel key and a delivery method accepting a standard message and a compatible target. `NotificationDispatcher` resolves registered channels and coordinates delivery.

`InAppChannel` is the only registered concrete channel in this delivery. It writes to `portal_notifications`, preserving the existing response shape and read behavior. Attendance, Billing and Community producers will call the dispatcher instead of creating `PortalNotification` records directly.

External destinations are configuration only in this phase. Since no external adapter or durable outbox exists, the dispatcher must not perform network delivery. An unavailable or disabled external channel is skipped without changing or rolling back an in-app notification. A later external adapter must not make a network request inside the originating business transaction; durable retries require a separately approved outbox/queue design.

## Destination Data Model

Create `notification_destinations` with channel-neutral fields:

| Field | Meaning |
| --- | --- |
| `id` | Internal identifier |
| `tenant_id` nullable | Null for RYLAY-global operations; set for tenant or school scope |
| `school_id` nullable | Null for global/tenant destinations; set only with its owning tenant |
| `channel` | Adapter key such as a future `telegram`; no provider-specific schema |
| `destination_type` | Neutral address class such as `group`, `channel` or `chat` |
| `destination_address` | Provider destination identifier, such as a future chat ID |
| `purpose` | Routing purpose such as `global_ops`, `tenant_admin` or `technical_alert` |
| `configuration` nullable | Non-secret channel-neutral options |
| `status` | `active` or `inactive` |
| timestamps | Configuration lifecycle timestamps |

The supported scope combinations are:

- Global: `tenant_id = null`, `school_id = null`.
- Tenant: `tenant_id` set, `school_id = null`.
- School: both set, with a composite foreign key proving that the school belongs to the tenant.

`school_id` without `tenant_id` is invalid. Foreign keys use restrictive deletion so an active destination cannot be silently detached from its organizational scope. The model exposes scope relationships and status helpers but no sending behavior.

The table stores no Bot token or other credential. Future provider secrets belong in protected runtime configuration or a separately approved secret store, never destination records or Git.

## Existing Data and API Compatibility

- No existing `portal_notifications` columns or rows are rewritten.
- Notification list/read APIs and Admin/App UI contracts remain unchanged.
- Existing notification types and context payloads remain unchanged.
- No destination CRUD API or UI is introduced.
- No external destination is seeded or enabled automatically.

## Failure and Transaction Behavior

- In-app persistence failures continue to fail the surrounding transaction exactly as direct model writes do today.
- The dispatcher validates channel/target compatibility before calling a channel.
- An unsupported external channel produces a non-delivered result and sanitized diagnostic logging; it does not pretend delivery succeeded.
- Destination resolution must always apply exact global, tenant or tenant-plus-school scope. A tenant request must never resolve another tenant's destination.
- Provider credentials and raw sensitive configuration must not appear in logs or audit payloads.

## Tests

Focused backend tests will cover:

- channel registration and compatible target dispatch;
- `InAppChannel` persistence and batch recipient behavior;
- unchanged Attendance, Billing and Community notification behavior through the dispatcher;
- global, tenant and school destination scopes;
- rejection of school-without-tenant and tenant/school mismatch;
- active versus inactive destination resolution;
- unsupported external channel behavior without affecting in-app delivery;
- migration schema, composite tenancy constraint and rollback.

SQLite-focused tests are required. Because this adds nullable hierarchy fields and a composite foreign key intended for MariaDB/MySQL, disposable MariaDB validation remains required for release qualification or must be reported as **Not verified**.

## Documentation Impact

Update current Architecture, Database, Project Overview, Current Status, Business Rules and Testing/Release documentation. Documentation must state clearly that Telegram delivery, tokens, queues/outbox, destination management UI and user binding are **Planned, not implemented**.

## Explicitly Out of Scope

- Telegram Bot API integration or adapter;
- Telegram login or Telegram-to-user association;
- Parent, Student or Teacher Telegram delivery;
- Bot tokens or secret management;
- delivery attempt/history tables;
- queues, retries or an outbox;
- destination management endpoints or UI;
- provider-specific columns.
