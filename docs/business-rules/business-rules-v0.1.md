# Matahari School ERP Business Rules

Version: 0.1
Status: Draft - Pending Approval
Project: Matahari School ERP

## 1. Purpose

This document is the official Business Rules foundation for Matahari School ERP.

It must be approved before continuing to:

- Payment workflow design
- Receipt workflow design
- Database design
- Backend implementation
- Frontend workflow implementation

## 2. Rule Governance

- Business rules must not be modified without approval.
- Missing or unknown rules must be marked as `TBD`.
- No assumptions should be converted into implementation behavior until approved.
- This document is the source of truth for future database design, backend implementation, and frontend workflow.

## 3. Module 1 - Student Management

### BR-S001 Student Identity

Every student has a unique Student ID.

Student ID is the primary identifier.

Student Name is only for display purposes.

All modules must reference Student ID instead of Student Name.

Affected Modules:

- Payments
- Receipts
- Fee Agreement
- General Fee Record
- Reports

### BR-S002 Student Status

Student status includes:

- Active
- Withdraw
- Graduate
- Suspended / Inactive

Student records must never be physically deleted.

Historical records must always be retained.

### BR-S003 Level Group

Current Level Groups:

- Kindergarten
- Primary
- Secondary
- STP

Each student belongs to one Level Group.

### BR-S004 Grade & Class

Students normally move to the next Grade once per academic year.

Grade/Class changes are administrative updates.

No automatic promotion is required for MVP.

### BR-S005 Student Overview

The Student List should prioritize information frequently used by Admin.

Display:

- Student Name
- Student ID
- Class
- Fee Amount
- Outstanding Balance
- Status

### BR-S006 Student Detail

Each Student Detail page should contain:

- Student Profile
- Parent / Guardian Information
- Fee Agreement
- Payment History
- Receipt History
- Outstanding Balance
- Remarks

### BR-S007 Historical Data

Withdrawn or Graduated students:

- cannot be deleted
- remain searchable
- retain all Payment records
- retain all Receipt records
- retain all Fee Agreements

## 4. Module 2 - Fee Agreement

### BR-F001 Fee Agreement

Each student owns one Fee Agreement.

Fee Agreements are independent.

Students in the same class may have different fee structures.

### BR-F002 Fee Agreement Lifetime

Fee Agreement is normally created during enrollment.

It remains valid throughout the academic year unless manually updated.

Historical versions should be preserved.

### BR-F003 Payment Plan

Supported plans:

- Monthly
- Termly
- Yearly

### BR-F004 Fee Items

Mandatory:

- Tuition Fee
- Misc Fee

Optional:

- Transport
- Meal
- Hostel
- Uniform
- Books
- Activity
- Others

### BR-F005 Discount Scope

Default behavior:

Most discounts apply only to Tuition Fee.

Misc Fee is normally excluded.

System must support future exceptions.

### BR-F006 Scholarship

Scholarship is currently treated as a fixed amount deduction.

It applies to the total payable amount.

### BR-F007 Old Student Pricing

Old Students may retain historical pricing.

Fee Agreements should not automatically follow new school pricing.

### BR-F008 Dynamic Discount

Some discounts depend on external conditions.

Example:

- Sibling Discount

If the related sibling graduates or withdraws, the discount may no longer be valid.

Exact business rules:

TBD.

### BR-F009 Mid-Year Enrollment

Prorated fee calculation:

TBD.

Current MVP:

Manual adjustment by Admin.

## 5. Pending Business Rules

The following areas require confirmation with school management.

### 5.1 Discount Rules

Need confirmation for:

- Teacher Child
- Sibling
- Referral
- Scholarship
- Multiple Discounts
- Discount Priority
- Approval Process

Status:

TBD

## 6. Approval Status

Business Rules Approval: TBD

Approved By: TBD

Approval Date: TBD

## 7. Change Log

| Version | Date | Change | Approved By |
| --- | --- | --- | --- |
| 0.1 | 2026-06-30 | Added Student Management and Fee Agreement business rules. Unknown rules marked as TBD. | TBD |
