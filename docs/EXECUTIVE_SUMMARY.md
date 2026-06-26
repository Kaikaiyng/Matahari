# Executive Summary

Project: IEM Education Platform
Version: 0.2
Date: 2026-06-26

## 1. Summary

Matahari International School currently manages many administration and finance workflows through Microsoft Excel. The most painful workflow is monthly school fee administration: copying worksheets, updating months and dates, changing receipt numbers, recording payments, checking outstanding balances, and preparing collection reports.

The proposed platform is the IEM Education Platform. The first version is a focused finance and billing MVP. It is not a full ERP. Its purpose is to replace the repetitive Excel-based finance workflow with a reliable web-based system while keeping the platform name broad enough for future modules.

## 2. Main Problem

The current manual process creates:

- Duplicate receipt number risk
- Formula mistakes
- Manual monthly preparation
- Difficult outstanding fee tracking
- Slow reporting
- Weak audit trail for financial corrections

The system should reduce these risks by turning the workflow into structured records and controlled actions.

## 3. MVP Scope

The MVP focuses on:

- Student records
- Parent records
- Fee templates
- Student fee template assignments and overrides
- Student discounts
- Monthly invoice generation
- Payment recording
- Automatic receipt numbers
- Receipt PDF
- Outstanding fee report
- Daily and monthly collection reports
- Dashboard
- Multi-school foundation

The key workflow is:

```text
Student
  -> Assign Fee Template and Discounts
  -> Generate Monthly Invoice
  -> Record Payment
  -> Generate Receipt
  -> Update Dashboard and Reports
```

## 4. Out of Scope for First Version

These are useful later, but should not delay the finance MVP:

- Attendance
- Teacher management
- Parent portal
- WhatsApp reminders
- Email reminders
- Online payment gateway
- Mobile app
- Timetable
- Accounting software integration

## 5. Expected Benefits

For admin and finance staff:

- Less monthly manual work
- Faster payment recording
- Fewer receipt number mistakes
- Easier outstanding balance checking
- Cleaner student ledger history

For principal:

- Clear view of collection, outstanding fees, overdue accounts, and active students

For CEO or group management:

- Future ability to compare collection and outstanding fees across schools

For the organization:

- A reusable foundation for Matahari and future IEM schools
- A platform name that can later include attendance, teacher, parent portal, academic, and HR modules

## 6. Recommended MVP Dashboard

The first dashboard should show:

- Today's Collection
- Monthly Collection
- Outstanding Fees
- Active Students
- Overdue Accounts
- Invoices This Month
- Recent Payments
- Outstanding Students

A concept mockup has been created in Canva:

- Edit: https://www.canva.com/d/waTV5XSLkhk3c18
- View: https://www.canva.com/d/CTiTU6jFQpFFMPy

## 7. Recommended Technology

Recommended stack:

- Frontend: React, TypeScript, TailwindCSS
- Backend: Laravel
- Database: MySQL
- Deployment: Docker, Nginx, Ubuntu VPS
- DNS: Cloudflare
- SSL: Let's Encrypt

This stack is practical for a small-to-medium school admin system, affordable to deploy, and maintainable on a VPS.

## 8. Estimated Operating Cost

For approximately 200 students:

| Item | Estimate |
| --- | --- |
| Domain | RM50-RM80/year |
| SSL | Free |
| VPS | RM25-RM60/month |
| Cloudflare | Free |
| Backup | RM10-RM20/month, optional |

Expected operating cost:

```text
Approximately RM50-RM80/month
```

## 9. MVP Success Criteria

The MVP is successful when:

- Admin can generate a full month of invoices without copying Excel.
- Receipt numbers are automatic and never duplicated.
- Finance can record full and partial payments.
- Outstanding fee report is accurate.
- Daily and monthly collection reports are accurate.
- Principal or CEO can trust dashboard totals.
- A second school can be added without code changes.
- Standard fee templates can be reused instead of editing every student one by one.

## 10. Key Decisions to Confirm

Before development starts, confirm:

1. Should bank transfer payments require verification before receipt?
2. Should receipt be generated automatically after every confirmed payment?
3. Do parents often pay multiple invoices or siblings in one transaction?
4. Are discounts applied to the whole invoice or only selected fee items?
5. How should one-time fees like registration be billed?
6. Is payment proof upload required in the first version?
7. What exact fields must appear on receipt PDF?
8. What reports must be exported to Excel or PDF?

## 11. Recommended Next Step

Run a short validation meeting with school admin, finance staff, principal, and CEO.

Use:

- `docs/DEMO_REVIEW_SCRIPT.md`
- `docs/STAKEHOLDER_QUESTIONS.md`
- Canva dashboard mockup

After the workflow and key decisions are confirmed, proceed to build:

```text
Laravel + React + MySQL + Docker MVP
```
