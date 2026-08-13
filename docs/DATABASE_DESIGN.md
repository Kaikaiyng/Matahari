# Database Design

Status: Current implementation reference

Last updated: 2026-08-13

Repeatable demo and default test database: SQLite

Optional development database: MariaDB

## 1. Current Financial Model

```text
Student
  -> Fee Agreement
  -> Fee Agreement Items
  -> Fee Record Charges
  -> Payment Allocations
  -> Payments
  -> Receipts
  -> Receipt Items
```

The active finance UI uses Fee Agreements and Fee Record charges. Legacy invoice tables remain in the schema for the earlier scaffold, but they are not the primary source for the implemented Student Detail, Outstanding Charge picker, Fee Record Summary, or Category Monthly workflows.

## 2. Design Rules

- School-owned records carry `school_id`.
- Student identity and status are retained; records are not physically deleted for normal status changes.
- Fee Agreements are versioned instead of overwritten.
- Agreement items preserve charge description, amount, classification, billing frequency, and billing months.
- Activated Fee Record charges represent expected balances.
- Payments and allocations are separate records.
- Partial allocations are supported.
- Receipt numbers are generated through a backend sequence.
- Receipts and receipt items snapshot the issued financial description.
- Payments and receipts use void metadata instead of hard deletion.
- Money is stored in decimal columns and handled as decimal/cents in application logic.
- Staff authenticate with a globally unique normalized username; staff email and password-reset-token storage are not part of the current schema.
- Calendar events are school-scoped and preserve creator/updater identities.
- Academic years, subjects, class enrolments, and teaching assignments preserve academic history without rewriting `students.class_id`.
- Parent/Student portal links are nullable and same-school; historical guardian access is never guessed or automatically activated.
- Daily Attendance preserves the original marker and records correction actor, reason, and time.

## 3. Schema Inventory

The current disposable demo schema contains 43 non-SQLite-internal tables, including Laravel infrastructure.

### Laravel infrastructure (7)

| Table | Responsibility |
| --- | --- |
| `migrations` | Applied Laravel migrations |
| `sessions` | Database-backed sessions |
| `cache` | Database cache values |
| `cache_locks` | Cache locks |
| `jobs` | Queued jobs |
| `job_batches` | Queue batch metadata |
| `failed_jobs` | Failed queue jobs |

### School, users, and permissions (7)

| Table | Responsibility |
| --- | --- |
| `schools` | School identity, code, prefixes, and contact details |
| `users` | Login users and optional school ownership |
| `roles` | Seeded role definitions |
| `permissions` | Permission slugs used by middleware and UI |
| `user_roles` | User-to-role mapping |
| `role_permissions` | Role-to-permission mapping |
| `audit_logs` | Audit event structure for material actions |

`users` stores `username`, not staff email. Parent/guardian contact email remains in the contacts domain.

### Students and contacts (4)

| Table | Responsibility |
| --- | --- |
| `classes` | School classes/year groups |
| `students` | Student number, identity, class/level, dates, and status |
| `parents` | Parent/guardian contact records |
| `student_parent_links` | Student-to-parent relationship and primary-contact flag |

### Legacy fee assignment setup (4)

| Table | Responsibility |
| --- | --- |
| `fee_items` | Reusable fee codes, categories, amounts, and status |
| `discount_items` | Reusable fixed/percentage discounts |
| `student_fee_assignments` | Earlier direct student fee assignment model |
| `student_discount_assignments` | Earlier direct student discount assignment model |

These tables remain useful for seeded configuration and legacy invoice behavior. The implemented agreement flow snapshots selected fee items into agreement items.

### Fee Agreements (4)

| Table | Responsibility |
| --- | --- |
| `fee_agreements` | Student/year agreement header, version, current flag, dates, and status |
| `fee_agreement_items` | Fee snapshot, amount, Charge Type, Billing Pattern, months, and preview rule |
| `fee_agreement_discounts` | Agreement-level discount snapshot and scope |
| `fee_agreement_discount_items` | Discount-to-agreement-item mapping |

### Fee Record and legacy invoices (4)

| Table | Responsibility |
| --- | --- |
| `fee_record_charges` | Activated expected charges, cached paid/outstanding values, origin, and statuses |
| `invoices` | Legacy invoice header |
| `invoice_items` | Legacy invoice item snapshot |
| `invoice_sequences` | Legacy invoice numbering sequence |

### Payments and receipts (5)

| Table | Responsibility |
| --- | --- |
| `payments` | Student payment, method, dates, amount, status, verification, and void data |
| `payment_allocations` | Allocation to Fee Record charges or exceptional manual allocation |
| `receipts` | Issued receipt snapshot, sequence number, amount in words, status, and void data |
| `receipt_items` | Receipt line snapshots derived from payment allocations |
| `receipt_sequences` | Per-school/year/prefix receipt counter |

### School operations (1)

| Table | Responsibility |
| --- | --- |
| `calendar_events` | School-scoped all-day/timed events, event details, and creator/updater audit users |

### Academic, portal, and Attendance foundation (7)

| Table | Responsibility |
| --- | --- |
| `academic_years` | School-scoped years and current-year state |
| `class_enrolments` | Student class history with one current enrolment slot |
| `subjects` | School-scoped subject catalogue |
| `teaching_assignments` | Teacher/class/subject/year scope and history |
| `portal_notifications` | Recipient-scoped durable in-app notifications |
| `attendance_sessions` | School/year/class/date/type attendance sessions |
| `attendance_records` | Per-student status, original marker, correction metadata, and notes |

Portal identity fields are additive columns on `parents`, `students`, and `student_parent_links`, not separate identity tables.

## 4. Key Records

### `students`

Important columns:

```text
id, school_id, class_id, level_group, student_no, full_name,
gender, dob, registration_date, status, notes, timestamps
```

Key rule: `student_no` is unique within a school. Status values support active, inactive, graduate, and withdraw behavior in the application.

### `fee_agreements`

Important columns:

```text
school_id, student_id, agreement_no, academic_year, version_no,
payment_plan, effective_from, effective_to, is_current, status,
remarks, created_by, updated_by
```

Key rules:

- Agreement numbers and version numbers preserve history.
- `is_current` identifies the active version used by the UI.
- Superseding creates a new row/version rather than rewriting the old agreement.

### `fee_agreement_items`

Important columns:

```text
fee_agreement_id, fee_item_id, fee_code, fee_category, description,
amount, is_mandatory, sort_order, classification, billing_frequency,
billing_months, requires_preview_confirmation
```

Display labels map `classification` to Charge Type and `billing_frequency` to Billing Pattern. Backend field names and enum values remain unchanged.

### `fee_record_charges`

Important columns:

```text
student_id, fee_agreement_id, fee_agreement_item_id, academic_year,
billing_month, fee_record_category, fee_code, description, remark,
expected_amount, paid_amount_cached, outstanding_amount_cached,
billing_status, collection_status, charge_origin, source_type,
skipped_reason, activated_at
```

Charge origin distinguishes scheduled agreement charges from manual charges. Cached paid/outstanding fields support the current ledger views but must remain consistent with valid allocations.

### `payments`

Important columns:

```text
student_id, payment_method, payment_date, received_date, amount,
paid_by, bank_account, reference_no, payment_proof, remark, status,
recorded_by, verified_by, verified_at, voided_at, voided_by, void_reason
```

Statuses include pending verification, verified, and voided behavior. A void must record who, when, and why.

### `payment_allocations`

Important columns:

```text
payment_id, fee_item_id, fee_agreement_item_id, fee_record_charge_id,
allocation_type, fee_code, description, amount, sort_order
```

Normal allocations reference a Fee Record charge. Manual allocation is explicitly labelled and must not silently clear an unrelated outstanding charge.

### `receipts` and `receipt_items`

The receipt header snapshots student, payer, payment method/dates, receipt date/number, amount, amount in words, issuer, status, and void details. Receipt items snapshot fee code, description, and amount for each payment allocation.

## 5. Critical Relationships

```text
schools 1 -> many users, students, fee items, agreements, charges, payments, receipts
schools 1 -> many classes and calendar_events
users 1 -> many created/updated calendar_events

students 1 -> many fee_agreements
fee_agreements 1 -> many fee_agreement_items
fee_agreement_items 1 -> many fee_record_charges
fee_record_charges 1 -> many payment_allocations
payments 1 -> many payment_allocations
payments 1 -> receipt lifecycle
receipts 1 -> many receipt_items
```

Foreign keys enforce the documented ownership and lifecycle relationships. Re-run migration and integrity checks after changing relationship columns; do not carry an old relationship count forward by hand.

## 6. Fee Record Generation

Preview input:

- Student
- Academic year
- Current Fee Agreement and its item configuration

Preview output:

- Proposed billing month
- Fee item/code/description
- Fee Record category
- Expected amount
- Warning or skipped reason

Activation rules:

- Persist only allowed preview rows.
- Prevent prohibited duplicates for the same agreement item/month.
- Preserve activation timestamp and charge origin.
- Keep blocking warnings visible to the caller.

Manual charges use explicit academic year, billing month, category, description, amount, and remark.

## 7. Payment Allocation

```text
1. Validate student, school, amount, method, and status.
2. Validate every selected charge belongs to the same student/school.
3. Reject allocations above charge outstanding.
4. Require allocation total to match payment amount.
5. Create payment and allocation rows in a transaction.
6. Update cached paid/outstanding and collection status.
7. Verification or void actions record their actor and timestamp.
8. Void reverses valid allocation effects.
```

## 8. Receipt Lifecycle

```text
Eligible Payment
  -> lock/create receipt sequence
  -> increment sequence
  -> create receipt header snapshot
  -> create receipt item snapshots
  -> display/print
```

Rules:

- A second generation attempt while an issued receipt exists is rejected with validation; generation is allowed again only after the issued receipt is voided.
- Receipt number is unique per school.
- Voiding records reason, user, and time.
- Voided sequence numbers are never reused.
- Regeneration after a permitted void receives a new number.
- Payment voiding is blocked while an active receipt exists.

## 9. MariaDB and SQLite

MariaDB is the production database direction. SQLite is used for the repeatable local demo and default automated tests; SQLite success is not MariaDB proof.

### MariaDB migration lifecycle

The historical payment-allocation foreign-key ordering problem is corrected by additive migration `2026_06_30_000006_ensure_payment_allocation_fee_agreement_item_foreign_key.php`. Phase A fresh migration, rollback/re-migration, existing-data upgrade, foreign-key, and index behavior were validated on disposable MariaDB. Production upgrade and rollback still require backups, a reviewed preflight, and an environment-specific recovery plan. Never use `migrate:fresh` against valuable data.

## 10. Backup and Security

- Keep local backups outside Git.
- Never commit `.env`, database passwords, phpMyAdmin credentials, or real student records.
- Use a restricted application database account.
- Bind local database administration tools to `127.0.0.1`.
- Test restoration before any production use.
- Production requires automated backups, access control, monitoring, and a reviewed correction process.

## 11. Deferred Schema Areas

The current schema does not complete Community posts/media/reactions/comments, Assessments/results, formal or Practice Quiz, payment reminders, device/push delivery, Statements, general Reports/Exports, PDF documents, or production dashboard aggregates. Parent/Student self-service and daily Attendance are partial implemented slices, not complete portal/academic products.
