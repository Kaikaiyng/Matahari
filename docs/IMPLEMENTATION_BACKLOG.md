# MVP Implementation Backlog

> **Historical backlog (June 2026).** This file preserves the original sprint plan and is not a current completion checklist. See [Implementation Status](IMPLEMENTATION_STATUS.md) for shipped modules and deferred scope.

Version: 0.2
Date: 2026-06-26

## 1. Foundation

### 1.1 Project Setup

- Create Laravel backend project.
- Create React + TypeScript + Tailwind frontend project.
- Configure Docker services for app, frontend, MySQL, and Nginx.
- Configure environment files for local development.
- Set up database migrations and seeders.

### 1.2 Authentication

Backend:

- Login API
- Logout API
- Forgot password API
- Reset password API
- Current user API

Frontend:

- Login page
- Forgot password page
- Reset password page
- Authenticated layout
- Route guards

### 1.3 Roles and School Scope

Backend:

- Role seed data
- Module and permission seed data
- Role-permission assignment
- User role assignment
- School scope middleware or policy layer
- Permission checks using permission slugs, not hardcoded role behavior
- School-level users vs group-level users scope checks

Frontend:

- Hide inaccessible navigation items.
- Show current school context.
- Show role label in top bar.

## 2. Core Records

### 2.1 Schools

Backend:

- School CRUD API
- School status handling
- Receipt prefix and invoice prefix validation

Frontend:

- School list
- School detail/edit form
- School settings page

### 2.2 Classes

Backend:

- Class CRUD API
- Unique class name per school

Frontend:

- Class list
- Class create/edit modal

### 2.3 Students

Backend:

- Student CRUD API
- Student search and filters
- Student status update
- Student profile API

Frontend:

- Student list
- Student create/edit form
- Student detail page
- Filters by class and status

### 2.4 Parents

Backend:

- Parent CRUD API
- Parent search API
- Student-parent linking API

Frontend:

- Parent list
- Parent create/edit form
- Link parent to student
- Show related students

## 3. Fee Setup

### 3.1 Fee Templates

Backend:

- Fee template CRUD API
- Fee template item attach/update/remove API
- Template active/inactive handling
- Template amount validation
- Tests proving template edits do not alter existing invoice snapshots

Frontend:

- Fee template list
- Fee template create/edit form
- Template item editor
- Assign template to student

### 3.2 Fee Items

Backend:

- Fee item CRUD API
- Recurring vs one-time validation
- Active/inactive handling

Frontend:

- Fee item list
- Fee item create/edit form

### 3.3 Student Fee Assignments and Overrides

Backend:

- Assign fee template to student API
- Assign fee to student API
- Override amount API
- Effective date handling
- One-time fee billing month handling
- Distinguish standard template assignment from student-specific exception

Frontend:

- Student fee template panel
- Student fees panel
- Add fee assignment
- Edit assigned amount
- Disable assigned fee

### 3.4 Discounts

Backend:

- Discount item CRUD API
- Student discount assignment API
- Fixed and percentage validation

Frontend:

- Discount item list
- Student discounts panel
- Add/edit discount assignment

## 4. Billing

### 4.1 Invoice Generation

Backend:

- Preview monthly invoice generation API
- Generate monthly invoices API
- Duplicate prevention
- Invoice number sequence
- Invoice item snapshot creation from fee templates, overrides, and discounts
- Audit log entries with old_values and new_values

Frontend:

- Generate invoices page
- Month picker
- Optional class filter
- Preview table
- Generate confirmation dialog
- Generation result summary

### 4.2 Invoice Management

Backend:

- Invoice list API
- Invoice detail API
- Invoice PDF API
- Void invoice API
- Invoice status recalculation service

Frontend:

- Invoice list
- Invoice filters
- Invoice detail page
- Download/print invoice
- Void invoice dialog

## 5. Payments and Receipts

### 5.1 Payments

Backend:

- Record payment API
- Payment list API
- Payment detail API
- Void payment API
- Payment allocation service
- Invoice paid/outstanding recalculation

Frontend:

- Payment entry form
- Payment list
- Payment detail
- Void payment dialog

### 5.2 Receipts

Backend:

- Receipt sequence service using database transaction
- Generate receipt API
- Ensure receipt is generated from payment, not directly from invoice
- Receipt PDF API
- Receipt list API
- Void receipt API

Frontend:

- Receipt list
- Receipt detail
- Download/print receipt
- Void receipt dialog

## 6. Dashboard and Reports

### 6.1 Dashboard

Backend:

- Today's collection metric
- Monthly collection metric
- Outstanding fees metric
- Active students metric
- Overdue accounts metric
- Invoices this month metric
- CEO group summary API

Frontend:

- School dashboard
- CEO dashboard
- KPI cards
- Recent payments table
- Outstanding students panel

### 6.2 Reports

Backend:

- Daily collection report API
- Monthly collection report API
- Outstanding report API
- Payment history report API
- Student ledger API
- Receipt listing API
- Excel export
- PDF export

Frontend:

- Reports index
- Report filters
- Report result tables
- Export buttons

## 7. Audit and Hardening

### 7.1 Audit Logs

Backend:

- Audit log writer
- Audit log list API
- Entity-based audit lookup
- Old/new value diff support
- Capture create, update, void, and correction snapshots

Frontend:

- Audit log page
- Filters by user, action, entity, and date
- Before/after value display

### 7.2 Reliability

- Validate all money values server-side.
- Use decimal values, never floating point.
- Add database unique indexes for invoice and receipt integrity.
- Add automated tests for invoice generation and receipt sequence.
- Add automated tests for permission checks.
- Add automated tests for audit old/new values.
- Add backup procedure for MySQL.
- Add seed data for demo school, users, fee items, and sample students.

## 8. Suggested First Sprint

Sprint goal:

Prove the core data model and admin shell.

Tasks:

1. Laravel + React + Docker setup
2. Auth login/logout
3. Schools, users, roles, modules, and permissions seed
4. Student CRUD
5. Parent CRUD
6. Fee template and fee item CRUD
7. Basic dashboard shell

## 9. Suggested Second Sprint

Sprint goal:

Prove monthly billing without Excel.

Tasks:

1. Student fee template assignment
2. Student fee override assignment
3. Discount assignment
4. Invoice preview
5. Invoice generation
6. Invoice detail
7. Duplicate invoice prevention
8. Invoice snapshot tests

## 10. Suggested Third Sprint

Sprint goal:

Prove collection and receipt workflow.

Tasks:

1. Payment entry
2. Partial payment support
3. Invoice status recalculation
4. Receipt sequence service
5. Receipt PDF
6. Void payment and receipt
7. Daily collection report
8. Outstanding report
