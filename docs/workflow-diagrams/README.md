# Matahari Workflow Atlas

Editable FigJam board: [Matahari Complete Project Workflow Atlas](https://www.figma.com/board/sGDlrRbsbHsuT5laZEzKa8?utm_source=other&utm_content=edit_in_figjam&oai_id=v1%2FwOVdpwOgFVs6eNhbOHdwC1cOfCUWewcVQHceqgjBVtixXsxAsX2TAY&request_id=5a0a7805-91cc-4e9d-8bc8-d191c5b72bb5)

## Diagram index

1. `00-reading-guide.mmd` — evidence hierarchy, status legend, and board index
2. `01-end-to-end.mmd` — system-wide actor and operational flow
3. `02-roles-and-permissions.mmd` — Super Admin, School Admin, Finance, and CEO role lanes
4. `03-auth-session-rbac.mmd` — login, session restore, authorization, and logout
5. `04-student-workspace.mmd` — student list, create, detail, status, and guardian boundaries
6. `05-fee-agreement.mmd` — agreement creation, versioning, snapshots, and validation
7. `06-fee-record.mmd` — preview, activation, manual charges, allocation surface, and ledgers
8. `07-payment.mmd` — recording, allocation, verification, receipt guard, and void reversal
9. `08-receipt.mmd` — generation, numbering, immutable snapshot, print, and void
10. `09-frontend-legacy-planned.mmd` — implemented, prototype, legacy, approved, and deferred areas
11. `10-finance-state-machines.mmd` — student, agreement, charge, payment, and receipt lifecycles
12. `11-school-scope.mmd` — current school isolation and future multi-school extension hook
13. `12-conflicts-and-caveats.mmd` — documentation conflicts, incomplete surfaces, and external checks
14. `13-core-api-map.mmd` — authentication, student, agreement, and Fee Record APIs
15. `14-finance-api-map.mmd` — payment, receipt, and unauthenticated legacy APIs

## Verification record

- Mermaid CLI 11.16.0 rendered all 15 sources successfully.
- Laravel route audit covered all 30 API routes.
- Permission audit covered all 23 current permission slugs.
- FigJam root inspection found all 15 generated diagram prefixes, 339 text-bearing shapes, and 32 named sections before the Starter-plan MCP inspection limit was reached.
- The complete canvas and ten high-risk sections were visually inspected after generation: all four role lanes, charge/payment/receipt state machines, security caveats, Fee Record APIs, and legacy APIs.
- Backend regression suite passed 92 tests with 597 assertions on 2026-07-14.
