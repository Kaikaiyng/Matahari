# Role and User Abilities Design

**Status:** Implemented on `feat/admin-application-logs`; final verification recorded in the delivery report

**Date:** 2026-08-23

## Objective

Simplify RYLAY identity and authorization so school positions are understandable, individual access is adjustable, App personas remain uncluttered, and every access change is auditable.

## Final Identity Model

### Platform

- **Super Admin** is the only platform-wide administrator.
- Super Admin can operate across every tenant and school and perform every supported action.
- Super Admin is derived from the protected platform-owner identity and cannot be created, assigned, reduced, or revoked by a school user.

### School employee positions

Each employee has one primary position:

- **Finance**: the highest school-level position. It inherits every School Admin default and adds complete supported finance capabilities.
- **School Admin**: school administration, students, classes, school Attendance, Calendar, Employees, school settings, and User Abilities management.
- **Teacher**: assigned teaching scope, class Attendance, schedules, assessments, quizzes, and Community defaults.

`CEO` and `Tenant Owner` are removed. Tenant configuration belongs to Super Admin. There is no General Staff position.

### App personas

The App exposes only:

- Teacher
- Parent
- Student

The Staff persona is removed. Parent-only and Student-only accounts never appear in Employees or Calendar Staff. An employee may also be a Parent. Such a user chooses Teacher or Parent on first App entry and may switch later; the App remembers the last persona. A Student cannot also be an employee.

School Admin and Finance accounts do not enter the App unless they have explicit Teacher App Access or also have a Parent identity. Principals and similar users use the Teacher persona with elevated abilities rather than a separate Principal persona.

## Effective Permission Model

Positions supply default permissions. Per-user overrides are authoritative and can explicitly grant or deny school-level abilities. Effective access is resolved on the backend:

1. A protected platform owner receives all permissions as Super Admin.
2. Every other request requires an active tenant membership and permitted school context.
3. Position defaults are loaded for the active membership.
4. Explicit per-user grants and denials are applied.
5. Resource scope such as school ownership and Teaching Assignment remains mandatory.

Frontend visibility is only a usability layer.

## User Abilities UI

Employees > Edit contains Position and grouped User Abilities checkboxes:

- Students: View; Create/Edit; Change Status
- Classes: View; Manage Classes; Manage Teaching Assignments
- Attendance: Assigned Classes; Whole School; Manage Records; Manage Devices
- Calendar: View; Create/Edit; Delete
- Finance: View Fee Records; Create Charges; Record Payments; Verify/Void Payments; Manage Receipts
- Community: View; Publish; Moderate
- Academics: Manage Schedule; Assessments; Quizzes
- Employees: View Employees; Manage Employees; Manage User Abilities
- System: Audit Trail; Application Logs; School Settings
- App: Teacher App Access

Selecting Manage automatically selects the related View ability. Clearing View clears dependent Manage abilities. Whole-school scope is always explicit.

Finance and School Admin may change other same-school Finance, School Admin, and Teacher accounts. They cannot edit themselves, assign Super Admin, grant platform/cross-school access, or bypass audit. Teacher cannot manage abilities.

## Default Templates

- **Finance** receives all School Admin defaults plus all supported financial reads and mutations, including payment verification/voiding and receipt management.
- **School Admin** receives broad school administration defaults; high-risk financial verification and void actions are not included by default.
- **Teacher** receives assigned-scope academic and Community defaults. Whole-school Attendance and broader school access require explicit abilities.

## Audit and Operational Logging

Every position, App access, or ability change requires a non-empty reason. The mutation and audit entry are written in the same database transaction. Audit failure rolls back the mutation.

Audit events include actor, target employee, tenant, school, position, before/after effective permissions, added/removed abilities, reason, request identifier, IP, and timestamp. Passwords, credentials, tokens, and secret values are excluded.

Canonical actions:

- `employee.position.changed`
- `employee.abilities.updated`
- `employee.app_access.changed`

Application Logs record only technical failures and do not duplicate successful authorization changes.

## Data and Migration

- Add a corrective migration for explicit membership/user permission overrides and required uniqueness/index constraints.
- Preserve existing historical audit records.
- Remove active use of CEO and Tenant Owner and reseed the unreleased demo identities into the final model.
- Finance receives the new inherited school-level template.
- Super Admin is recognized only through the protected platform-owner identity; no legacy school role is automatically promoted.
- Parent and Student identities remain relationship- and membership-scoped.

## Enforcement and Testing

Backend tests must cover effective grants and denials, self-edit rejection, unauthorized ability editing, platform-permission rejection, cross-school and cross-tenant rejection, dependent View/Manage rules, required reason, audit rollback, persona derivation, Calendar Staff filtering, and Finance inheritance. Admin tests cover grouped checkboxes and immediate draft interaction; App tests cover first-use persona choice and removal of Staff persona.

MariaDB-sensitive schema and rollback behavior remains **Not verified** until run against a disposable MariaDB database.
