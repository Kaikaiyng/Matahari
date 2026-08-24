# Permissions

**Status:** Current role, persona, and per-user authorization contract

**Reviewed:** 2026-08-23

Backend authorization is authoritative. Navigation visibility, disabled controls, and App persona selection are usability controls only.

## Identities and Positions

- **Super Admin** is the protected global `users.is_platform_owner` identity. It has full platform, tenant, and school access and cannot be assigned or edited by a school employee.
- A school employee has exactly one position: **School Admin**, **Finance**, or **Teacher**.
- **Finance** is the advanced Admin template: every School Admin default plus complete supported finance mutations, including payment verification/void and receipt void.
- **Teacher** defaults to assigned teaching scope. An authorized Admin may grant or deny individual school abilities, allowing principal or temporary coordinator access without creating another position.
- Parent and Student are relationship/App identities, not employee positions. An employee may also be Parent. Student and employee identity must not be combined.
- Historical `ceo` and `tenant-owner` rows may remain in upgraded databases for referential history, but they are not seeded, assignable, or used as active authorization templates.

## App Personas

The App exposes exactly **Teacher**, **Parent**, and **Student** personas. There is no Staff persona.

- Teacher is available to the Teacher position or an employee with effective `app.teacher_access`.
- Elevated Teachers still appear as Teacher; school-wide tools are controlled by effective backend abilities.
- Parent and Student are derived from their stored identities/relationships.
- When more than one persona is valid, the first App entry requires a choice and the last choice is stored on that device.
- Finance or School Admin without Teacher App Access and without a Parent identity cannot enter the App.

## User Abilities

`user_permission_overrides` stores school-scoped explicit grants and denials. Effective permissions are resolved in this order:

1. Platform owner bypass.
2. Active hostname-selected tenant membership role defaults.
3. Same-school explicit grant/deny override.
4. Active historical time-window Attendance grant compatibility.

The Admin Employees editor groups grantable abilities under Students, Classes, Attendance, Calendar, Finance, School Updates, Academics, Employees, and App. Manage abilities imply their View dependency. Clearing View also clears dependent Manage selections.

School Admin and Finance may edit another same-school School Admin, Finance, or Teacher when they have `employees.abilities.manage`. They cannot edit themselves, a platform owner, a different-school user, platform-only permissions, or grant Super Admin. Every position, ability, or Teacher App Access change requires a non-empty reason and writes Audit Trail records in the same database transaction. Audit failure rolls back the access change.

## Key Enforcement Slugs

| Area | View/default scope | Manage/elevated scope |
| --- | --- | --- |
| Employees | `employees.view` | `employees.manage`, `employees.abilities.manage` |
| Attendance | `attendance.view_assigned`, `attendance.view_school` | `attendance.manage_assigned`, `attendance.manage_school`, `attendance.devices.manage` |
| Students | `students.view` | `students.create`, `students.update`, `students.update_status` |
| Classes | `class_enrolments.view`, `teaching_assignments.view` | matching `.manage` permissions |
| Calendar | `calendar.view` | `calendar.create`, `calendar.update`, `calendar.delete` |
| Finance | fee/payment/receipt `.view` permissions | record, verify, void, print, reminder, and agreement mutations |
| Academics | year/subject/schedule views | their manage permissions plus school-wide assessment/quiz permissions |
| School Updates | `community.view` (read authorized Updates) | `community.publish` (official publish/edit/withdraw own while effective), `community.moderate` (manage same-school Updates and Post Reports) |
| App | relationship self-service permissions | `app.teacher_access` |

`audit.view`, `logs.view`, tenant configuration, platform Community intervention, domain activation, and cross-tenant operations remain platform-only unless a later reviewed policy explicitly changes them.

`community.view` is required for the Updates feed. The effective same-school `community.publish` ability is the backend publishing authority; it permits whole-school and any active same-school class audience and does not add a second position or Teaching Assignment check. The current Admin ability editor grants it only through employee access management, and it never follows from the Teacher, Parent, or Student persona itself. An author must retain that ability to edit or withdraw their own Update; `community.moderate` independently permits same-school management. Parent and Student active access is read, Like, and Post Report; it does not include publish, edit, withdraw, hide, or report decisions. Moderators decide reports and are not offered reporting on Updates. `community.interact` and historical block/restriction/appeal permissions do not enable active social or School Update workflows.

## Scope Rules

- Resolve an active verified hostname before membership, permission, school, and resource checks.
- Never accept a client-submitted tenant ID as authority.
- Same-school permission does not authorize another school or tenant.
- Material student, finance, employee-position, and User Ability mutations audit inside the same transaction.
- Audit routes are read-only and require `audit.view`.
