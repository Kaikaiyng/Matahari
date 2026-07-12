# IEM Education Platform PRD

> **Historical planning baseline (June 2026).** This PRD preserves the original target scope and should not be read as a list of completed features. See the [project README](../README.md), [Implementation Status](IMPLEMENTATION_STATUS.md), and [UAT Checklist](UAT_CHECKLIST.md) for current implemented scope.

Version: 0.2
Date: 2026-06-26
Initial school: Matahari International School

## 1. Product Summary

The product is the IEM Education Platform, a web-based school administration platform for Matahari International School and, later, other schools under IEM Education Group.

The platform name should remain broad enough for future modules such as Student, Finance, Attendance, Teacher, Parent Portal, Academic, Reports, and Settings.

The first MVP module should remain narrow: finance, billing, receipts, outstanding fees, and reports. Its first job is to replace repetitive Excel-based finance administration: monthly invoice preparation, payment tracking, receipt numbering, outstanding fee checking, and collection reporting.

This is not intended to compete with full enterprise school ERPs such as PowerSchool. The product should solve the practical operating pain points of small and medium-sized schools that still depend heavily on spreadsheets.

## 2. Current Problem

Most administration and finance workflows are currently handled manually in Microsoft Excel.

Current monthly workflow:

```text
Previous Month Excel
        ->
Copy Sheet
        ->
Change Month
        ->
Change Receipt Number
        ->
Change Date
        ->
Manual Payment Recording
        ->
Manual Outstanding Checking
```

This creates several problems:

- Duplicate receipt numbers
- Manual formula mistakes
- Time-consuming month-end preparation
- Difficult outstanding fee tracking
- Manual reporting for principals and group management
- Weak audit trail for financial corrections

## 3. Product Goals

Primary goals:

- Generate monthly invoices without copying Excel sheets.
- Automatically generate receipt numbers without duplicates.
- Record full and partial payments.
- Calculate student fee totals and discounts without spreadsheet formulas.
- Provide accurate outstanding fee reports.
- Provide daily and monthly collection reports.
- Support multiple schools using a shared architecture.

Non-goals for MVP:

- Attendance
- Teacher management
- Parent portal
- Timetable
- Mobile app
- WhatsApp reminder
- Online payment gateway
- Accounting software export
- Full configurable ERP workflow

## 4. Target Users

| User | Main Needs |
| --- | --- |
| School Admin | Manage students, parents, classes, fees, invoices, and school records. |
| Finance/Admin Staff | Record payments, generate receipts, check outstanding fees, and export reports. |
| Principal | View school-level financial and student summaries. |
| CEO | View group-level reports across all schools. |
| Super Admin | Manage schools, users, roles, and system settings. |

## 5. Roles and Permissions

Initial roles:

- Super Admin
- CEO
- School Admin
- Finance

Permission direction:

Avoid hardcoding role behavior directly into controllers or frontend navigation. Use a flexible model:

```text
Role
        ->
Permission
        ->
Module
```

Example:

```text
Finance
  can payment.create
  can receipt.view
  cannot student.delete
```

Initial role matrix:

| Module | Super Admin | CEO | School Admin | Finance |
| --- | --- | --- | --- | --- |
| Dashboard | All schools | All schools | Own school | Own school |
| Students | Manage all | View all | Manage own school | View own school |
| Parents | Manage all | View all | Manage own school | View own school |
| Fees | Manage all | View all | Manage own school | Manage own school |
| Invoices | Manage all | View all | Manage own school | Manage own school |
| Payments | Manage all | View all | Manage own school | Manage own school |
| Receipts | Manage all | View all | Manage own school | Manage own school |
| Reports | All schools | All schools | Own school | Own school |
| Users | Manage all | View | Manage school users | No access |
| Schools | Manage | View | No access | No access |

## 6. Core Workflow

```text
Student Registration
        ->
Parent Information Setup
        ->
Assign Fee Template
        ->
Generate Monthly Invoice
        ->
Record Parent Payment
        ->
Generate Receipt
        ->
Update Invoice Status
        ->
Dashboard and Reports Updated
```

## 7. MVP Modules

### 7.1 Authentication and User Management

Features:

- Login
- Logout
- Forgot password
- Change password
- User management
- Role-based access control
- School-level data isolation

Important rules:

- School-level users can only access records from their assigned school.
- CEO and Super Admin can access group-level reports.

### 7.2 School Management

Features:

- Create school
- Edit school profile
- Set school code and receipt prefix
- Store address and contact details
- Active/inactive status

Important rule:

Every business table must include `school_id` unless it is explicitly global. Future schools should not require code changes.

### 7.3 Student Module

Student fields:

| Field | Description |
| --- | --- |
| Student ID | Unique student identifier |
| Name | Student full name |
| Gender | Male / Female |
| DOB | Date of birth |
| Class | Current class |
| Status | Active / Inactive / Graduated / Withdrawn |
| Registration Date | Date student joined |
| Notes | Internal notes |

Features:

- Add student
- Edit student
- View profile
- Search and filter by class/status
- Activate/deactivate student
- Link student to parents
- Assign fees and discounts

MVP rule:

Only active students should be included in monthly invoice generation.

### 7.4 Parent Module

Parent fields:

| Field | Description |
| --- | --- |
| Name | Parent or guardian full name |
| Phone | Primary contact number |
| Email | Email address |
| Address | Residential address |
| Emergency Contact | Emergency contact number |
| Relationship | Father / Mother / Guardian |
| Notes | Internal notes |

Features:

- Add parent
- Edit parent
- Link parent to one or multiple students
- View related students
- Search by name, phone, or email

Important rule:

Student and parent relationship should support many-to-many linking.

### 7.5 Fee Template and Fee Structure Module

Fee setup should use templates before individual student overrides.

Target design:

```text
Fee Template
        ->
Template Fee Items
        ->
Assign Template to Student
        ->
Optional Student-level Override
```

Example templates:

- Nursery Fee
- Primary Year 1 Fee
- Primary Year 2 Fee
- Transport Add-on

Benefits:

- Updating standard tuition can be done on one template instead of hundreds of student records.
- Student-specific exceptions remain possible through overrides.
- Invoice generation can snapshot the assigned template items at the time of billing.

Fee item examples:

- Tuition Fee
- Transport Fee
- Registration Fee
- Meal Fee
- Material Fee
- Activity Fee
- Uniform Fee
- Other Fee

Fee item fields:

| Field | Description |
| --- | --- |
| Name | Fee item name |
| Type | Recurring / One-time |
| Default Amount | Standard amount |
| Status | Active / Inactive |

Features:

- Create fee templates
- Attach fee items to templates
- Assign a template to a student
- Create fee items
- Edit fee items
- Assign fee items directly to students only for exceptions
- Override amount per student
- Enable/disable fee items
- Support recurring and one-time fees

Important rule:

Invoice generation must snapshot the student's assigned fees. If current fee settings change later, existing invoices must not change.

### 7.6 Discount Module

Discount examples:

- Sibling Discount
- Old Student Discount
- Referral Discount
- Scholarship
- Custom Discount

Discount calculation types:

- Fixed amount
- Percentage

Features:

- Create discount item
- Assign discount to student
- Start date and end date
- Active/inactive status
- Optional reason or note

MVP rule:

Do not build a complex rule engine in the first version. Discounts should be explicitly assigned to students and calculated during invoice generation.

Important rule:

Invoice generation must snapshot discounts at the time the invoice is created.

### 7.7 Monthly Invoice Generation

User action:

```text
Generate July 2026 Invoices
```

Invoice fields:

| Field | Description |
| --- | --- |
| Invoice Number | Unique invoice identifier |
| School | Linked school |
| Student | Linked student |
| Invoice Month | Example: July 2026 |
| Issue Date | Date invoice generated |
| Due Date | Payment due date |
| Subtotal | Total before discounts |
| Discount Total | Total discount |
| Grand Total | Final payable amount |
| Paid Amount | Amount paid |
| Outstanding Amount | Remaining amount |
| Status | Pending / Partial / Paid / Overdue / Void |

Features:

- Generate invoices by month
- Preview before generation
- Prevent duplicate student invoice for the same month
- View invoice list
- View invoice detail
- Void invoice if needed
- Print/download invoice PDF

Business rules:

- Only active students are included.
- Student must have assigned fees.
- The system must not generate duplicate invoices for the same student and month.
- Invoice items must be snapshotted.
- Existing invoices must not change after fee or discount settings change.
- If an invoice already has a payment, financial fields should not be freely editable.

### 7.8 Payment Module

Payment methods:

- Cash
- Bank Transfer
- QR
- Online Payment, future only

Payment fields:

| Field | Description |
| --- | --- |
| Payment Date | Date payment was received |
| Student | Linked student |
| Invoice | Linked invoice |
| Amount | Payment amount |
| Method | Cash / Bank Transfer / QR |
| Reference Number | Bank reference if applicable |
| Received By | User who recorded payment |
| Notes | Optional notes |

Features:

- Record payment for invoice
- Support partial payment
- View payment history
- Void payment with reason
- Automatically update invoice paid and outstanding amounts

Invoice status rules:

| Condition | Status |
| --- | --- |
| Paid amount = 0 | Pending |
| Paid amount > 0 and less than total | Partial |
| Paid amount >= total | Paid |
| Due date passed and outstanding > 0 | Overdue |

### 7.9 Receipt Module

Receipt number example:

```text
MIS-2026-000001
MIS-2026-000002
MIS-2026-000003
```

Receipt fields:

| Field | Description |
| --- | --- |
| Receipt Number | Auto-generated unique number |
| School | Linked school |
| Payment | Linked payment |
| Student | Linked student |
| Receipt Date | Date receipt was generated |
| Amount | Receipt amount |
| Generated By | User who generated receipt |
| Status | Active / Void |

Features:

- Auto-generate receipt number
- Prevent duplicate receipt numbers
- Print/download receipt PDF
- View receipt list
- Void receipt with reason
- Reprint receipt

Critical rule:

Receipt numbers must be generated by the backend using database transactions or locking. Normal users should not manually edit receipt numbers.

Invoice and receipt separation:

```text
Invoice Created
        ->
Waiting Payment
        ->
Payment Received
        ->
Receipt Generated
```

An invoice is a bill. A receipt is proof of payment. The system must never treat them as the same object.

### 7.10 Dashboard

School-level metrics:

- Today's Collection
- Monthly Collection
- Outstanding Fees
- Active Students
- New Students
- Overdue Accounts
- Invoices This Month

CEO dashboard:

- Total collection across all schools
- Outstanding fees across all schools
- Collection by school
- Active students by school
- Overdue accounts by school
- Monthly trend

MVP rule:

Useful numbers are more important than decorative charts.

### 7.11 Reports

MVP reports:

- Daily Collection
- Monthly Collection
- Outstanding Report
- Payment History
- Student Ledger
- Receipt Listing

Filters:

- School
- Date range
- Month
- Student
- Class
- Payment method
- Invoice status
- Receipt status

Export:

- Excel
- PDF

Important rule:

Reports must be generated from invoice, payment, and receipt records, not manually entered summary numbers.

### 7.12 Audit Log

Actions to log:

- Login
- Create/edit student
- Create/edit parent
- Assign/change student fees
- Generate invoice
- Edit/void invoice
- Record payment
- Void payment
- Generate receipt
- Void receipt
- Export report

Audit log fields:

| Field | Description |
| --- | --- |
| User | Who performed the action |
| School | Related school |
| Action | What happened |
| Entity Type | Student / Invoice / Payment / Receipt |
| Entity ID | Related record ID |
| Timestamp | When it happened |
| Old Values | JSON snapshot before the change |
| New Values | JSON snapshot after the change |
| Details | Human-readable summary or reason |

Important rule:

For changed records, audit logs should record old value and new value, not only the action name.

Example:

```text
Fee
RM800
        ->
RM850
```

## 8. Suggested Screens

Main navigation:

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

Key screens:

| Screen | Purpose |
| --- | --- |
| Login | User authentication |
| Dashboard | Key financial and operational metrics |
| Student List | Search and filter students |
| Student Detail | Profile, parents, fees, invoices, and payments |
| Parent List | Search and manage parents |
| Fee Items | Manage fee items |
| Student Fee Assignment | Assign fees and discounts |
| Invoice List | View monthly invoices |
| Generate Invoices | Generate invoices by month |
| Invoice Detail | View items, payments, and status |
| Payment Entry | Record payment |
| Receipt Detail | View and download receipt |
| Reports | Generate and export reports |
| User Management | Manage users and roles |
| School Settings | School profile and receipt prefix |
| Audit Logs | Review system actions |

## 9. Success Metrics

The MVP is successful if:

- Admin can generate a full month of invoices without copying Excel.
- Receipt numbers are automatically generated and never duplicated.
- Admin can record full and partial payments.
- Outstanding report is accurate.
- Daily and monthly collection reports are accurate.
- School admin time is reduced compared with the Excel workflow.
- CEO can view school-level and group-level collection summaries.
- A second school can be added without code changes.
- Fee template changes can be managed without editing every student one by one.
- Important financial edits can be traced through old/new audit values.

## 10. Initial Technology Direction

Preferred stack:

- Frontend: React, TypeScript, TailwindCSS
- Backend: Laravel or Node.js
- Database: MySQL
- Authentication: Session or JWT
- Deployment: Docker, Nginx, Ubuntu VPS

Recommended backend for MVP:

- Laravel, because it is strong for admin systems, authentication, validation, reports, PDF generation, Excel export, queues, and MySQL-based business applications.

## 11. Current Visual Mockup

A first Canva concept mockup has been generated for discussion:

- Edit URL: https://www.canva.com/d/waTV5XSLkhk3c18
- View URL: https://www.canva.com/d/CTiTU6jFQpFFMPy

The mockup is intended as a discussion artifact, not a final developer-ready UI specification.
