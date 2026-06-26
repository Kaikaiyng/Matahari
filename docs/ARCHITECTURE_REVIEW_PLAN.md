# Architecture Review and Improvement Plan

Version: 0.1
Date: 2026-06-26
Product: IEM Education Platform

## 1. Overall Evaluation

The project direction is solid and is moving beyond a simple CRUD practice project toward a real enterprise-style school administration system.

Strengths:

- Clear business objective
- Well-defined MVP
- Good database direction
- Enterprise-style architecture
- Designed for real-world deployment

Current positioning:

```text
IEM Education Platform
        ->
First MVP: Finance, Billing, Receipts, Outstanding Fees, Reports
```

## 2. Designs to Keep

### 2.1 Multi-school Architecture

Every school-owned business table should include `school_id`.

Future structure:

```text
IEM Education Group
        ->
Matahari International School
Kindergarten A
Kindergarten B
Future Schools
```

### 2.2 Receipt Sequence Table

Do not generate receipt numbers with:

```sql
MAX(receipt_no) + 1
```

Use a dedicated `receipt_sequences` table with row locking inside a database transaction.

Benefits:

- Prevent duplicate receipt numbers
- Safe under concurrent users
- Enterprise-grade numbering

### 2.3 Invoice Snapshot

Invoices must store historical fee information.

If tuition changes next month, old invoices must remain unchanged.

`invoice_items` are the source of historical billing detail, not the current fee setup tables.

## 3. Required Improvements

### 3.1 Rename Product

Use:

```text
IEM Education Platform
```

Do not limit the platform name to School Fee Management System.

Reason:

The platform should later support:

- Student
- Finance
- Attendance
- Teacher
- Parent Portal
- Academic
- Reports
- Settings

### 3.2 Separate Invoice and Receipt

Invoice and receipt must never be treated as the same object.

Workflow:

```text
Invoice Created
        ->
Waiting Payment
        ->
Payment Received
        ->
Receipt Generated
```

### 3.3 Introduce Fee Template

Standard design:

```text
Fee Template
        ->
Assign Template to Student
        ->
Optional Student Override
```

Examples:

- Nursery Fee
- Primary Year 1 Fee
- Primary Year 2 Fee

Benefit:

Updating standard tuition should not require editing hundreds of student records.

### 3.4 Improve Audit Log

Audit logs should record:

```text
Old Value
        ->
New Value
```

Example:

```text
Fee
RM800
        ->
RM850
```

### 3.5 Improve Permission System

Avoid hardcoded role behavior.

Target model:

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

## 4. Current Priority

Before adding more features, complete business workflow discovery with Matahari administration.

Document:

- Student admission process
- Fee structure creation
- Discount rules
- Monthly billing process
- Payment methods
- Receipt issuance
- Outstanding handling
- Refund process
- Reporting process

The software should digitize the existing workflow rather than forcing the school to change how it works.

## 5. Final Development Goal

Build a modern cloud-based school administration platform that first serves Matahari International School, then scales to every school under IEM Education Group.

The objective is not to compete with large ERP vendors. The objective is to eliminate manual Excel-based administration while keeping the workflow familiar to staff.
