# Admin Settings Workspace Design

**Date:** 2026-08-29

**Status:** Approved design; implementation pending

## Objective

Replace the current display-only Settings cards with a MAW-inspired two-pane workspace using RYLAY/MIS styling. Only current backend capabilities may appear as editable controls.

## Layout and Motion

- Desktop uses one bordered settings shell with a 260px section rail and one content panel.
- Narrow screens move the rail above the panel as horizontally scrollable section buttons; no native select is used.
- Active sections use the current tenant primary color, RYLAY typography, icons, borders and radii rather than MAW blue styling.
- Section content uses a short fade/translate transition and respects reduced-motion preferences.
- Parent layouts own the standard 16px gap.

## Sections

### School Profile

Show the resolved tenant, current school name/code/ID and timezone. It remains read-only because no current-school update endpoint exists.

### Branding

Users with `tenant.settings.manage` may edit organization name/short name, Admin/App titles, HTTPS logo URL and primary/accent colors through the existing `PATCH /api/v1/tenant/branding` endpoint. Other users receive a read-only view. Successful saves update the tenant context, CSS brand variables and document title immediately without a page reload.

### Attendance

Users with `attendance.devices.manage` may edit arrival and dismissal times through the existing Attendance settings API and navigate to the Attendance Hub for device management. Users without the ability see the current values only when the API authorizes them; no frontend permission substitutes for backend enforcement.

### Notifications

Show the tenant's existing in-app notification feature state. Users with `attendance.devices.manage` may edit the existing guardian entry/exit notification switches. Both switches share the same Attendance settings payload as arrival/dismissal times. Do not expose external destinations, Telegram configuration, Bot credentials, queues or delivery history.

### Users & Access

Explain the current School Admin, Finance and Teacher positions plus User Abilities. An authorized user can navigate to the existing Employees page; Settings does not create a second employee editor.

### My Account

Show the signed-in user's name, username, roles and effective permission count. Password and session controls are omitted because they are not implemented.

## Component Boundaries

- Move Settings UI from `App.tsx` into `frontend/src/features/settings/SettingsPage.tsx` and a colocated stylesheet.
- `SettingsPage` owns active-section state, Attendance settings loading/saving and validation feedback.
- Extend the tenant context with an in-memory branding update method so all current consumers refresh immediately after a successful save.
- `App.tsx` supplies the current user, dashboard context and page-navigation callback only.

## Loading, Errors and Permissions

- Loading and errors stay inside the active content panel.
- Failed saves preserve form input and show the existing system-styled error message.
- Save buttons appear only with the matching effective permission and disable while saving.
- Attendance and notification sections reuse one loaded settings object so saving one section never overwrites the other section with stale defaults.

## Validation

Add focused Admin component tests for section switching, branding save/context refresh, Attendance/notification payload preservation, permission-based read-only behavior and Employees navigation. Run focused Vitest, Oxlint and the Admin production build; no backend or App behavior changes.

## Out of Scope

- New backend endpoints, migrations or permissions;
- school-profile editing;
- Telegram/external destination management;
- password/session management;
- duplicate employee, device or role editors;
- placeholder or Coming Soon modules.
