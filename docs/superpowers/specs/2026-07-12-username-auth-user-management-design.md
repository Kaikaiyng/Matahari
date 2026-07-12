# Username Authentication and Internal User Management Design

**Date:** 2026-07-12
**Status:** Approved design
**Product:** Matahari Admin Finance MVP

## 1. Purpose

Matahari Admin Finance is an internal school staff system. Staff must authenticate with a username and password rather than an email address. Email remains a contact-data field for students and parents only.

The system must also give the highest-privilege staff role a practical way to create, edit, activate, deactivate, assign roles to, and reset passwords for internal user accounts without weakening financial auditability.

## 2. Scope

This change includes:

- username-and-password staff authentication;
- migration of the three existing staff accounts from email identifiers to usernames;
- removal of staff email and email-verification concepts from the user model and UI;
- fixed-role assignment for staff accounts;
- a CEO read-only permission template;
- Super Admin-only user administration;
- password creation and reset by Super Admin;
- deactivation instead of permanent user deletion;
- audit logs for user-administration actions;
- responsive user-management UI for desktop, iPad, and mobile;
- backend, frontend, migration, and browser QA coverage.

This change does not include:

- public registration;
- email verification or email-based password recovery;
- self-service password changes;
- custom role creation;
- per-user permission overrides;
- permanent deletion of staff users;
- a universal or master password;
- storing or displaying an existing password in plaintext;
- parent or student portal authentication.

## 3. Account Model

Each staff account has:

- `username`: required, unique, case-insensitive, 3–50 characters;
- `name`: required staff display name;
- `password`: a one-way password hash;
- `status`: `active` or `inactive`;
- one fixed role;
- `school_id`: retained for the existing school or global scope;
- `last_login_at`: retained for administration and audit context.

Valid usernames contain only ASCII letters, digits, `.`, `_`, and `-`. Input is trimmed and normalized to lowercase before validation and persistence.

The staff user model no longer contains or exposes `email` or `email_verified_at`. The unused email-based password-reset table is removed because password recovery is exclusively an authenticated Super Admin operation.

## 4. Existing Account Migration

The migration adds and backfills `users.username` before removing staff email fields.

The known accounts map as follows:

| Existing email | New username |
| --- | --- |
| `superadmin@mis.test` | `superadmin` |
| `admin@mis.test` | `admin` |
| `finance@mis.test` | `finance` |

For any other existing user, the migration derives a normalized username from the email local part. If two local parts collide, it adds a deterministic numeric suffix before applying the unique constraint. The migration must work on both the active MariaDB database and the SQLite test database.

Passwords, user IDs, school assignments, roles, historical financial references, and `last_login_at` values are preserved.

## 5. Authentication

`POST /api/login` accepts only:

```json
{
  "username": "admin",
  "password": "..."
}
```

Authentication behavior:

- normalize the username to lowercase;
- authenticate against `users.username` and the stored password hash;
- reject inactive accounts even when the password is correct;
- regenerate the session on successful login;
- update `last_login_at`;
- return `username`, not email, in the current-user payload;
- use the same generic invalid-credentials message for unknown usernames and incorrect passwords;
- reject the legacy email login payload.

There is no universal password or alternate authentication bypass. A password can authenticate only the account whose hash matches it.

## 6. Fixed Roles and Permissions

Each user is assigned exactly one of four fixed roles. The existing many-to-many tables remain in place to avoid a broad RBAC refactor, but user-management writes synchronize exactly one role per user.

### Super Admin

Super Admin retains all 23 current business permissions and receives:

- `users.view`;
- `users.create`;
- `users.update`;
- `users.update_status`;
- `users.reset_password`.

Only Super Admin receives user-management permissions.

### CEO

CEO is read-only and receives:

- `students.view`;
- `parents.view`;
- `fee_items.view`;
- `fee_agreements.view`;
- `fee_record.view`;
- `payments.view`;
- `receipts.view`.

CEO cannot create, edit, generate, verify, void, print as an operational action, or manage users.

### School Admin

School Admin keeps its current operational permissions: student and parent maintenance, Fee Agreement maintenance, Fee Record generation and management, payment entry, and receipt generation/printing. It cannot manage Fee Items, verify or void payments, void receipts, or manage users.

### Finance

Finance keeps its current review permissions: read access to students, parents, Fee Items, Fee Agreements, and Fee Records; payment verification and voiding; and receipt generation, viewing, printing, and voiding. It cannot maintain students, parents, agreements, charges, or users and cannot create payments.

## 7. User-Management API

All routes use the existing authenticated session middleware and permission middleware.

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/users` | `users.view` | List users and their single assigned role |
| `POST` | `/api/users` | `users.create` | Create an active or inactive user with an initial password |
| `PATCH` | `/api/users/{user}` | `users.update` | Update name, username, and role |
| `PATCH` | `/api/users/{user}/status` | `users.update_status` | Activate or deactivate a user |
| `POST` | `/api/users/{user}/reset-password` | `users.reset_password` | Replace a user's password hash |
| `GET` | `/api/roles` | `users.view` | Return the four fixed roles and permission descriptions |

There is no `DELETE /api/users/{user}` route.

User list payloads include ID, name, username, role, status, school scope, and last-login time. They never include a password hash or password-reset value.

## 8. Validation and Lockout Protection

User creation and editing enforce:

- unique normalized username;
- username length of 3–50;
- permitted username characters;
- required display name;
- one valid fixed-role ID;
- status limited to `active` or `inactive`;
- password and confirmation of at least 8 characters when creating or resetting.

Safety rules:

- a user cannot deactivate their own account;
- a user cannot remove their own Super Admin role;
- the last active Super Admin cannot be deactivated or assigned another role;
- inactive users cannot authenticate;
- concurrent updates re-check the active Super Admin count inside a database transaction;
- validation errors appear next to the relevant field;
- permission failures return `403`, missing users return `404`, and invalid form data returns `422`.

## 9. Password Handling

Only Super Admin can set an initial password or reset a password. Ordinary staff cannot view, change, or recover their own password in this phase.

On create or reset:

- the form offers show/hide controls while the Super Admin is typing;
- the frontend can keep the just-entered value visible until the confirmation flow is dismissed;
- the API stores only the framework-generated one-way hash;
- the API does not echo the password;
- audit logs omit the password and its hash;
- the password is never written to application logs, Git, Seeder output, or Notion.

Existing passwords cannot be viewed or recovered by any user, including Super Admin. A forgotten password is handled by setting a new password.

## 10. Audit Logging

The existing `audit_logs` table records:

- `user.created`;
- `user.updated`;
- `user.activated`;
- `user.deactivated`;
- `user.password_reset`.

Each entry records the acting user, target user, school scope, time, IP address, user agent, and relevant non-secret old/new values. Passwords and password hashes are never placed in `old_values` or `new_values`.

Deactivated users and their relationships remain in the database so historical financial and audit references remain valid.

## 11. Frontend Experience

### Login

The login form contains Username, Password, and Login only. It does not prefill demonstration credentials. Labels, validation, keyboard behavior, focus states, and touch targets remain suitable for iPad and mobile.

The error copy is generic: “The username or password is incorrect.” An inactive account does not receive a more revealing public login error.

### Settings for Super Admin

Settings contains a user-management area with:

- a user list;
- create-user action;
- edit action;
- reset-password action;
- deactivate/activate action;
- role descriptions and status badges;
- empty, loading, validation, permission, and request-error states.

Desktop and iPad landscape use a readable table. iPad portrait and mobile use stacked user cards so actions never sit at the far edge of a horizontally scrolling row.

Create, edit, and reset actions use responsive dialogs. Dialogs fit the viewport, keep their heading and close control visible, scroll internally when required, and keep footer actions above mobile browser UI.

Destructive deactivation uses a clear confirmation dialog. The current user and last active Super Admin show disabled actions with a short explanation.

### Settings for Other Roles

Non-Super Admin users see only their own name, username, role, status, and effective permissions. They do not receive the user-list request and cannot see account-management actions.

## 12. Implementation Boundaries

The work follows existing Laravel sessions and RBAC patterns. It may add focused controllers, requests, resources, and a small frontend user-management component. It must not introduce a routing rewrite, state-management rewrite, framework replacement, custom role editor, or broad `App.tsx` refactor.

## 13. Test Strategy

Backend test-first coverage includes:

- successful username login and current-user payload;
- username normalization;
- legacy email payload rejection;
- invalid credentials and inactive-account rejection;
- logout and session behavior;
- CEO read-only access and mutation denial;
- Super Admin user list, creation, edit, role assignment, activation, deactivation, and password reset;
- non-Super Admin `403` responses for every management route;
- duplicate and invalid username validation;
- password confirmation and minimum length;
- self-deactivation and self-demotion rejection;
- last-active-Super-Admin protection;
- audit entry creation with no password data;
- preservation of user IDs and role assignments through migration.

Frontend test-first coverage includes login payload/validation, role-based rendering, responsive user-list representation, create/edit/reset flows, and disabled dangerous actions. A focused component may be extracted from `App.tsx` to keep these behaviors independently testable.

Final verification includes:

- full backend PHPUnit suite on SQLite;
- migration and smoke verification on the active local MariaDB database;
- frontend lint and production build;
- frontend component tests;
- `git diff --check`;
- browser QA at 1440×900, 1180×820, 820×1180, and 390×844;
- login and user-management QA as Super Admin, CEO, School Admin, Finance, and an inactive user;
- real iPad Safari testing when available.

## 14. Success Criteria

The change is complete when internal staff log in only with username and password, employee email no longer appears in authentication or staff account data, Super Admin can safely manage fixed-role accounts and reset passwords, CEO has read-only access, deactivation preserves records, lockout safeguards are enforced, and all secrets remain one-way hashed and absent from logs and responses.
