# System Architecture and API Draft

Version: 0.2
Date: 2026-06-26

## 1. Architecture Summary

Recommended MVP architecture:

```text
Users
  ->
Browser
  ->
Cloudflare
  ->
Ubuntu VPS
  ->
Docker
  |-- Nginx
  |-- React frontend
  |-- Laravel API
  |-- MySQL
```

This architecture is intentionally simple. It supports the first Matahari deployment and can later grow into the multi-school IEM Education Platform and future SaaS setup.

## 2. Application Layers

### 2.1 Frontend

Stack:

- React
- TypeScript
- TailwindCSS

Responsibilities:

- Admin dashboard
- CRUD screens
- Forms and validation feedback
- Tables, filters, and exports
- Invoice/payment/receipt workflows
- Role-aware navigation

The frontend should not calculate official invoice totals, receipt numbers, or financial status. It can preview values, but backend remains the source of truth.

### 2.2 Backend

Recommended stack:

- Laravel
- MySQL
- Laravel queues, optional later

Responsibilities:

- Authentication
- Authorization and school scoping
- Business validation
- Invoice generation
- Payment allocation
- Receipt sequencing
- PDF/Excel export
- Audit logging

### 2.3 Database

Database:

- MySQL

Responsibilities:

- Transactional financial records
- Unique constraints for receipt and invoice integrity
- School-level data separation
- Historical snapshots

## 3. Backend Module Boundaries

Suggested Laravel modules/services:

| Module | Responsibility |
| --- | --- |
| Auth | Login, logout, password reset, current user |
| Schools | School profile, prefixes, status |
| Users | Users, roles, permissions |
| Students | Students, classes, parent links |
| Fees | Fee templates, fee items, student fee assignments |
| Discounts | Discount items, student discount assignments |
| Invoices | Invoice generation, invoice detail, invoice PDF |
| Payments | Payment recording, allocations, void flow |
| Receipts | Receipt sequence, receipt PDF, void flow |
| Reports | Dashboard metrics and report exports |
| Audit | Audit logs for important actions |

Important services:

- `InvoiceGenerationService`
- `InvoiceNumberService`
- `PaymentRecordingService`
- `InvoiceBalanceService`
- `ReceiptNumberService`
- `ReceiptPdfService`
- `AuditLogService`

## 4. Authorization Model

Recommended approach:

- Use role-permission checks for feature access.
- Use school scope checks for data access.
- Apply school scope in backend, not only frontend.

Target model:

```text
Role
        ->
Role Permission
        ->
Permission
        ->
Module
```

Rules:

- Super Admin can manage all schools and users.
- CEO can view all schools and reports, but should not need daily data entry permissions.
- School Admin can manage data within assigned school.
- Finance can manage invoices, payments, receipts, and reports within assigned school.

Every API that reads or writes school-owned data should verify the user's allowed `school_id`.

Avoid hardcoding role names in business services. Role names can remain seeded defaults, but controller and policy checks should use permission slugs such as `payment.create`, `receipt.void`, or `student.delete`.

## 5. API Style

Recommended style:

- REST API
- JSON responses
- Server-side pagination for list screens
- Filter parameters for reports and tables
- Consistent error format

Example error response:

```json
{
  "message": "Validation failed.",
  "errors": {
    "amount": ["Payment amount must be greater than zero."]
  }
}
```

## 6. API Endpoint Draft

### 6.1 Auth

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Current user |
| POST | `/api/forgot-password` | Request reset |
| POST | `/api/reset-password` | Reset password |

### 6.2 Schools and Users

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/schools` | List schools |
| POST | `/api/schools` | Create school |
| GET | `/api/schools/{school}` | School detail |
| PUT | `/api/schools/{school}` | Update school |
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/{user}` | Update user |
| POST | `/api/users/{user}/roles` | Assign roles |

### 6.3 Classes, Students, Parents

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/classes` | List classes |
| POST | `/api/classes` | Create class |
| PUT | `/api/classes/{class}` | Update class |
| GET | `/api/students` | List students |
| POST | `/api/students` | Create student |
| GET | `/api/students/{student}` | Student detail |
| PUT | `/api/students/{student}` | Update student |
| POST | `/api/students/{student}/parents` | Link parent |
| DELETE | `/api/students/{student}/parents/{parent}` | Unlink parent |
| GET | `/api/parents` | List parents |
| POST | `/api/parents` | Create parent |
| GET | `/api/parents/{parent}` | Parent detail |
| PUT | `/api/parents/{parent}` | Update parent |

### 6.4 Fees and Discounts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/fee-templates` | List fee templates |
| POST | `/api/fee-templates` | Create fee template |
| GET | `/api/fee-templates/{feeTemplate}` | Fee template detail |
| PUT | `/api/fee-templates/{feeTemplate}` | Update fee template |
| POST | `/api/fee-templates/{feeTemplate}/items` | Add fee item to template |
| PUT | `/api/fee-templates/{feeTemplate}/items/{templateItem}` | Update template item |
| POST | `/api/students/{student}/fee-template` | Assign fee template |
| GET | `/api/fee-items` | List fee items |
| POST | `/api/fee-items` | Create fee item |
| PUT | `/api/fee-items/{feeItem}` | Update fee item |
| GET | `/api/students/{student}/fees` | Student fee assignments |
| POST | `/api/students/{student}/fees` | Assign fee |
| PUT | `/api/students/{student}/fees/{assignment}` | Update assigned fee |
| DELETE | `/api/students/{student}/fees/{assignment}` | Disable assigned fee |
| GET | `/api/discount-items` | List discount items |
| POST | `/api/discount-items` | Create discount item |
| PUT | `/api/discount-items/{discountItem}` | Update discount item |
| GET | `/api/students/{student}/discounts` | Student discount assignments |
| POST | `/api/students/{student}/discounts` | Assign discount |
| PUT | `/api/students/{student}/discounts/{assignment}` | Update discount |
| DELETE | `/api/students/{student}/discounts/{assignment}` | Disable discount |

### 6.5 Invoices

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/invoices` | List invoices |
| GET | `/api/invoices/{invoice}` | Invoice detail |
| POST | `/api/invoices/generation-preview` | Preview monthly generation |
| POST | `/api/invoices/generate-monthly` | Generate monthly invoices |
| POST | `/api/invoices/{invoice}/void` | Void invoice |
| GET | `/api/invoices/{invoice}/pdf` | Download invoice PDF |

Generation request example:

```json
{
  "school_id": 1,
  "invoice_month": "2026-07",
  "issue_date": "2026-07-01",
  "due_date": "2026-07-10",
  "class_id": null
}
```

Generation result example:

```json
{
  "created_count": 187,
  "skipped_count": 3,
  "skipped": [
    {
      "student_id": 15,
      "reason": "Invoice already exists for 2026-07."
    }
  ]
}
```

### 6.6 Payments

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/payments` | List payments |
| POST | `/api/payments` | Record payment |
| GET | `/api/payments/{payment}` | Payment detail |
| POST | `/api/payments/{payment}/void` | Void payment |

Payment request example:

```json
{
  "student_id": 10,
  "invoice_id": 99,
  "payment_date": "2026-07-05",
  "amount": "840.00",
  "method": "bank_transfer",
  "reference_no": "MBB123456"
}
```

### 6.7 Receipts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/receipts` | List receipts |
| GET | `/api/receipts/{receipt}` | Receipt detail |
| POST | `/api/payments/{payment}/receipt` | Generate receipt if not automatic |
| POST | `/api/receipts/{receipt}/void` | Void receipt |
| GET | `/api/receipts/{receipt}/pdf` | Download receipt PDF |

### 6.8 Dashboard and Reports

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard/school` | School-level dashboard |
| GET | `/api/dashboard/group` | CEO group dashboard |
| GET | `/api/reports/daily-collection` | Daily collection |
| GET | `/api/reports/monthly-collection` | Monthly collection |
| GET | `/api/reports/outstanding` | Outstanding report |
| GET | `/api/reports/payment-history` | Payment history |
| GET | `/api/reports/student-ledger` | Student ledger |
| GET | `/api/reports/receipts` | Receipt listing |

Export pattern:

```text
GET /api/reports/outstanding?format=json
GET /api/reports/outstanding?format=xlsx
GET /api/reports/outstanding?format=pdf
```

## 7. Frontend Navigation

Recommended navigation:

- Dashboard
- Students
- Parents
- Fees
- Invoices
- Payments
- Receipts
- Reports
- Users
- Settings
- Audit Logs

Initial dashboard widgets:

- Today's Collection
- Monthly Collection
- Outstanding Fees
- Active Students
- Overdue Accounts
- Invoices This Month
- Recent Payments
- Outstanding Students

## 8. PDF and Export Direction

MVP PDF documents:

- Invoice PDF
- Receipt PDF
- Outstanding report PDF

MVP Excel exports:

- Daily collection
- Monthly collection
- Outstanding report
- Payment history
- Receipt listing

Implementation direction:

- Generate PDFs on backend.
- Generate Excel exports on backend.
- Use official school name, address, and receipt prefix from `schools`.

## 9. Testing Priorities

Highest-risk tests:

1. Monthly invoice generation does not duplicate invoices.
2. Invoice item snapshots remain unchanged after fee edits.
3. Partial payments correctly update invoice status.
4. Receipt numbers never duplicate under concurrent requests.
5. Voiding payment recalculates invoice balance.
6. School-level users cannot access another school's records.
7. Reports exclude void payments and void invoices correctly.
8. Fee template edits do not change existing invoice snapshots.
9. Permission checks are based on permission slugs, not hardcoded role names.
10. Audit logs capture old_values and new_values for financial corrections.

## 10. Deployment Notes

Initial VPS setup:

- Ubuntu VPS
- Docker Compose
- Nginx reverse proxy
- MySQL container or managed MySQL
- Daily database backup
- Cloudflare DNS
- Let's Encrypt SSL

Estimated initial scale:

- Around 200 students for first school
- Low concurrent usage
- Admin-heavy workload

This scale does not require complex infrastructure. Reliability, backup, and clean financial records matter more than horizontal scaling in MVP.
